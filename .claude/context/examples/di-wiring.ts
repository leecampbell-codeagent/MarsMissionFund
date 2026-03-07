// packages/backend/src/composition-root.ts
import type { Pool } from 'pg';
import { MockEmailAdapter } from './campaign/adapters/mock/mock-email-adapter';
import { PgCampaignRepository } from './campaign/adapters/pg/pg-campaign-repository';
import { SesEmailAdapter } from './campaign/adapters/ses/ses-email-adapter';
import { CreateCampaignService } from './campaign/application/create-campaign-service';

export function createServices(pool: Pool) {
  const campaignRepo = new PgCampaignRepository(pool);
  const emailAdapter =
    process.env.MOCK_EMAIL === 'true' ? new MockEmailAdapter() : new SesEmailAdapter();

  return {
    createCampaign: new CreateCampaignService(campaignRepo, emailAdapter),
    // ... other services
  };
}
