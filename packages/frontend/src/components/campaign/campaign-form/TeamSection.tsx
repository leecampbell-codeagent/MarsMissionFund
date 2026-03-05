import { type ReactElement, type ChangeEvent } from 'react';
import { type Campaign, type TeamMember } from '../../../types/campaign';
import { Button } from '../../ui/Button';

interface TeamSectionProps {
  readonly campaign: Campaign;
  readonly onChange: (field: string, value: TeamMember[]) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  padding: '10px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-tertiary)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const memberCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

/**
 * TeamSection — Team member entries with add/remove functionality.
 * At least 1 team member required at submission.
 */
export function TeamSection({ campaign, onChange }: TeamSectionProps): ReactElement {
  const members = campaign.teamMembers;

  const addMember = () => {
    const newMember: TeamMember = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      bio: null,
      linkedInUrl: null,
    };
    onChange('teamMembers', [...members, newMember]);
  };

  const removeMember = (index: number) => {
    onChange('teamMembers', members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof TeamMember, value: string | null) => {
    const updated = members.map((m, i) =>
      i === index ? { ...m, [field]: value } : m,
    );
    onChange('teamMembers', updated);
  };

  return (
    <section aria-label="Team Members" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Team Members
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
        At least 1 team member required. Max 20.
      </p>

      {members.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px' }}>
          No team members added yet.
        </p>
      )}

      {members.map((member, index) => (
        <div key={index} style={memberCardStyle} aria-label={`Team member ${index + 1}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Member {index + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => removeMember(index)} aria-label={`Remove team member ${index + 1}`}>
              Remove
            </Button>
          </div>

          <div>
            <label htmlFor={`member-name-${index}`} style={labelStyle}>Name *</label>
            <input
              id={`member-name-${index}`}
              type="text"
              value={member.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateMember(index, 'name', e.target.value)}
              placeholder="Full name"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor={`member-role-${index}`} style={labelStyle}>Role *</label>
            <input
              id={`member-role-${index}`}
              type="text"
              value={member.role}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateMember(index, 'role', e.target.value)}
              placeholder="e.g. Chief Engineer"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor={`member-bio-${index}`} style={labelStyle}>Bio</label>
            <textarea
              id={`member-bio-${index}`}
              value={member.bio ?? ''}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                updateMember(index, 'bio', e.target.value || null)
              }
              placeholder="Brief background"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label htmlFor={`member-linkedin-${index}`} style={labelStyle}>LinkedIn URL</label>
            <input
              id={`member-linkedin-${index}`}
              type="url"
              value={member.linkedInUrl ?? ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateMember(index, 'linkedInUrl', e.target.value || null)
              }
              placeholder="https://linkedin.com/in/..."
              style={inputStyle}
            />
          </div>
        </div>
      ))}

      {members.length < 20 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={addMember}
          disabled={members.length >= 20}
        >
          + Add Team Member
        </Button>
      )}
    </section>
  );
}
