export const CampaignCategory = {
  Propulsion: 'propulsion',
  EntryDescentLanding: 'entry_descent_landing',
  PowerEnergy: 'power_energy',
  HabitatsConstruction: 'habitats_construction',
  LifeSupportCrewHealth: 'life_support_crew_health',
  FoodWaterProduction: 'food_water_production',
  InSituResourceUtilisation: 'in_situ_resource_utilisation',
  RadiationProtection: 'radiation_protection',
  RoboticsAutomation: 'robotics_automation',
  CommunicationsNavigation: 'communications_navigation',
} as const;

export type CampaignCategory = (typeof CampaignCategory)[keyof typeof CampaignCategory];

export const CAMPAIGN_CATEGORIES: readonly CampaignCategory[] = Object.values(CampaignCategory);
