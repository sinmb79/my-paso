import type { POICategory } from "@/types";

export type LocalAIVendor = "naver" | "kakao" | "lg" | "skt";
export type LocalAICapability = "text" | "vision";
export type LocalAIEndpointScope = "loopback" | "private_lan";
export type LocalAIIntent = "journal_draft" | "classify_keywords" | "photo_alt";

export type LocalAISettings = {
  enabled: boolean;
  vendor: LocalAIVendor;
  endpoint: string;
  model: string;
  capability: LocalAICapability;
  confirmedPrivateLANEndpoint: string | null;
};

export type LocalAIDraft = {
  title: string;
  body: string;
  category: POICategory | null;
  keywords: string[];
  mood: string | null;
  altText: string;
  observations: string[];
};

export type LocalAIRequestPreview = {
  intent: LocalAIIntent;
  placeName: string | null;
  note: string;
  imageDataUrl: string | null;
};

export type LocalAIModelCatalogItem = {
  vendor: LocalAIVendor;
  label: string;
  textModel: string;
  visionModel: string;
  modelCardUrl: string;
  licenseNotice: string;
};

export type LocalAIEndpointValidation =
  | {
      ok: true;
      scope: LocalAIEndpointScope;
      origin: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_url"
        | "unsupported_scheme"
        | "credentials_not_allowed"
        | "query_not_allowed"
        | "fragment_not_allowed"
        | "endpoint_path_not_allowed"
        | "hostname_not_allowed"
        | "public_address_not_allowed"
        | "private_lan_https_required"
        | "confirmation_required";
    };
