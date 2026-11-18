import { languagePath, SITE_URL, type Language } from "./i18n";

export const campaigns = {
  facebook_groups: { source: "facebook", medium: "social" },
  whatsapp_community: { source: "whatsapp", medium: "messaging" },
  urdu_launch: { source: "community", medium: "social" },
  organic_community: { source: "community", medium: "referral" },
} as const;
export type Campaign = keyof typeof campaigns;

export function shareUrl(language: Language, campaign?: Campaign) {
  const url = new URL(languagePath(language), SITE_URL);
  if (campaign) {
    url.searchParams.set("utm_source", campaigns[campaign].source);
    url.searchParams.set("utm_medium", campaigns[campaign].medium);
    url.searchParams.set("utm_campaign", campaign);
  }
  return url.href;
}
export function campaignParameters(search: string) {
  const query = new URLSearchParams(search);
  const name = query.get("utm_campaign");
  if (!name || !Object.hasOwn(campaigns, name)) return {};
  const campaign = campaigns[name as Campaign];
  if (query.get("utm_source") !== campaign.source || query.get("utm_medium") !== campaign.medium) return {};
  return { campaign_name: name, campaign_source: campaign.source, campaign_medium: campaign.medium };
}
export function whatsappUrl(language: Language, text: string) {
  return "https://wa.me/?text=" + encodeURIComponent(text + " " + shareUrl(language, "whatsapp_community"));
}
export async function shareWebsite(language: Language, title: string, text: string,
  platform: { share?: (data: ShareData) => Promise<void>; copy: (text: string) => Promise<void> }) {
  const url = shareUrl(language);
  if (platform.share) {
    try {
      await platform.share({ title, text, url });
      return "native" as const;
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      // Some in-app browsers expose share but reject its use.
    }
  }
  await platform.copy(url);
  return "clipboard" as const;
}
