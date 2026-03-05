import type { Logger } from 'pino';
import type { EventStorePort } from '../../shared/ports/event-store-port.js';
import type { TransactionPort } from '../../shared/ports/transaction-port.js';
import { Contribution } from '../domain/contribution.js';
import { EscrowLedgerEntry } from '../domain/escrow-ledger-entry.js';
import {
  InvalidContributionAmountError,
  PaymentGatewayError,
} from '../domain/payment-errors.js';
import type { ContributionRepository } from '../ports/contribution-repository.js';
import type { EscrowLedgerRepository } from '../ports/escrow-ledger-repository.js';
import type { PaymentGatewayPort } from '../ports/payment-gateway-port.js';
import type { ProcessedWebhookEventRepository } from '../ports/processed-webhook-event-repository.js';

export interface CaptureContributionInput {
  readonly donorId: string;
  readonly campaignId: string;
  readonly amountCents: number;
  readonly paymentMethodToken: string;
}

export class PaymentAppService {
  constructor(
    private readonly contributionRepository: ContributionRepository,
    private readonly escrowLedgerRepository: EscrowLedgerRepository,
    private readonly processedWebhookEventRepository: ProcessedWebhookEventRepository,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly eventStore: EventStorePort,
    private readonly transactionPort: TransactionPort,
    private readonly logger: Logger,
  ) {}

  async captureContribution(input: CaptureContributionInput): Promise<Contribution> {
    if (!Number.isInteger(input.amountCents) || input.amountCents < 100) {
      throw new InvalidContributionAmountError();
    }

    const contribution = Contribution.create({
      donorId: input.donorId,
      campaignId: input.campaignId,
      amountCents: input.amountCents,
    });

    await this.contributionRepository.save(contribution);

    const outcome = await this.paymentGateway.capturePayment({
      contributionId: contribution.id,
      amountCents: input.amountCents,
      currency: 'usd',
      paymentMethodToken: input.paymentMethodToken,
      metadata: {
        campaignId: input.campaignId,
        donorId: input.donorId,
        contributionId: contribution.id,
      },
    });

    if (outcome.success) {
      const capturedContribution = contribution.capture(outcome.gatewayReference);

      const ledgerEntry = EscrowLedgerEntry.create({
        campaignId: input.campaignId,
        entryType: 'contribution',
        amountCents: input.amountCents,
        contributionId: contribution.id,
        description: 'Contribution captured',
      });

      try {
        await this.transactionPort.withTransaction(async (txClient) => {
          await this.contributionRepository.update(capturedContribution, txClient);
          await this.escrowLedgerRepository.appendEntry(ledgerEntry, txClient);
          const seq = await this.eventStore.getNextSequenceNumber(contribution.id, txClient);
          await this.eventStore.append(
            {
              eventType: 'PAYMENT.CONTRIBUTION_CAPTURED',
              aggregateId: contribution.id,
              aggregateType: 'contribution',
              sequenceNumber: seq,
              correlationId: contribution.id,
              sourceService: 'payment-service',
              payload: {
                donorId: input.donorId,
                campaignId: input.campaignId,
                amountCents: input.amountCents,
                gatewayReference: outcome.gatewayReference,
              },
            },
            txClient,
          );
        });
      } catch (dbError) {
        this.logger.fatal(
          {
            contributionId: contribution.id,
            gatewayReference: outcome.gatewayReference,
            error: dbError,
          },
          'CRITICAL: Gateway capture succeeded but DB write failed. Manual investigation required.',
        );

        const refundOutcome = await this.paymentGateway.refundPayment({
          gatewayReference: outcome.gatewayReference,
          amountCents: input.amountCents,
          reason: 'duplicate',
        });

        this.logger.info(
          { refundOutcome, contributionId: contribution.id },
          'Compensating refund attempted after DB write failure',
        );

        throw dbError;
      }

      return capturedContribution;
    }

    // Capture failed
    const failedContribution = contribution.fail();
    await this.contributionRepository.update(failedContribution);

    const seq = await this.eventStore.getNextSequenceNumber(
      contribution.id,
      // Use a mock client — event store writes outside transaction for failed captures
      { _brand: 'TransactionClient' } as Parameters<typeof this.eventStore.getNextSequenceNumber>[1],
    );
    await this.eventStore.append(
      {
        eventType: 'PAYMENT.CONTRIBUTION_FAILED',
        aggregateId: contribution.id,
        aggregateType: 'contribution',
        sequenceNumber: seq,
        correlationId: contribution.id,
        sourceService: 'payment-service',
        payload: {
          donorId: input.donorId,
          campaignId: input.campaignId,
          amountCents: input.amountCents,
          errorCode: outcome.errorCode,
        },
      },
      { _brand: 'TransactionClient' } as Parameters<typeof this.eventStore.append>[1],
    );

    throw new PaymentGatewayError(outcome.errorCode, outcome.errorMessage);
  }

  async processWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const event = await this.paymentGateway.parseWebhookEvent(rawBody, signature);

    if (event.eventType === 'unknown') {
      this.logger.warn({ eventId: event.eventId, eventType: event.eventType }, 'Unknown webhook event type, ignoring');
      return;
    }

    const alreadyProcessed = await this.processedWebhookEventRepository.hasBeenProcessed(
      event.eventId,
    );
    if (alreadyProcessed) {
      this.logger.info({ eventId: event.eventId }, 'Webhook event already processed, skipping');
      return;
    }

    await this.transactionPort.withTransaction(async (txClient) => {
      switch (event.eventType) {
        case 'payment_intent.succeeded': {
          if (event.contributionId) {
            const contribution = await this.contributionRepository.findById(event.contributionId);
            if (contribution && contribution.status !== 'captured') {
              const gatewayRef = event.gatewayReference ?? `pi_webhook_${event.eventId}`;
              const capturedContribution = contribution.capture(gatewayRef);
              await this.contributionRepository.update(capturedContribution, txClient);

              const ledgerEntry = EscrowLedgerEntry.create({
                campaignId: contribution.campaignId,
                entryType: 'contribution',
                amountCents: contribution.amountCents,
                contributionId: contribution.id,
                description: 'Contribution captured via webhook',
              });
              await this.escrowLedgerRepository.appendEntry(ledgerEntry, txClient);

              const seq = await this.eventStore.getNextSequenceNumber(contribution.id, txClient);
              await this.eventStore.append(
                {
                  eventType: 'PAYMENT.CONTRIBUTION_CAPTURED',
                  aggregateId: contribution.id,
                  aggregateType: 'contribution',
                  sequenceNumber: seq,
                  correlationId: event.eventId,
                  sourceService: 'payment-service',
                  payload: {
                    donorId: contribution.donorId,
                    campaignId: contribution.campaignId,
                    amountCents: contribution.amountCents,
                    gatewayReference: gatewayRef,
                  },
                },
                txClient,
              );
            }
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          if (event.contributionId) {
            const contribution = await this.contributionRepository.findById(event.contributionId);
            if (contribution && contribution.status === 'pending_capture') {
              const failedContribution = contribution.fail();
              await this.contributionRepository.update(failedContribution, txClient);

              const seq = await this.eventStore.getNextSequenceNumber(contribution.id, txClient);
              await this.eventStore.append(
                {
                  eventType: 'PAYMENT.CONTRIBUTION_FAILED',
                  aggregateId: contribution.id,
                  aggregateType: 'contribution',
                  sequenceNumber: seq,
                  correlationId: event.eventId,
                  sourceService: 'payment-service',
                  payload: {
                    donorId: contribution.donorId,
                    campaignId: contribution.campaignId,
                    amountCents: contribution.amountCents,
                  },
                },
                txClient,
              );
            }
          }
          break;
        }

        case 'charge.refunded':
          this.logger.info({ eventId: event.eventId }, 'charge.refunded: logged for future feat-010 processing');
          break;

        case 'charge.refund.updated':
          this.logger.info({ eventId: event.eventId }, 'charge.refund.updated: logged for future processing');
          break;

        default:
          break;
      }

      await this.processedWebhookEventRepository.markAsProcessed(
        event.eventId,
        event.eventType,
        txClient,
      );
    });
  }

  async getEscrowBalance(
    campaignId: string,
  ): Promise<{ balanceCents: number; entryCount: number }> {
    const balanceCents = await this.escrowLedgerRepository.getBalanceCents(campaignId);
    const entries = await this.escrowLedgerRepository.getEntriesForCampaign(campaignId);
    return { balanceCents, entryCount: entries.length };
  }
}
