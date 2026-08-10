import type { LocalAIModelCatalogItem } from "./contracts";

export const LOCAL_AI_MODEL_CATALOG: readonly LocalAIModelCatalogItem[] = [
  {
    vendor: "naver",
    label: "NAVER HyperCLOVA X SEED",
    textModel: "HyperCLOVAX-SEED-Text-Instruct-0.5B",
    visionModel: "HyperCLOVAX-SEED-Vision-Instruct-3B",
    modelCardUrl:
      "https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Text-Instruct-0.5B",
    licenseNotice: "Review the applicable HyperCLOVA X SEED license before use.",
  },
  {
    vendor: "kakao",
    label: "Kakao Kanana",
    textModel: "kanana-2-1.3b-instruct",
    visionModel: "kanana-1.5-v-3b-instruct",
    modelCardUrl: "https://huggingface.co/kakaocorp/kanana-2-1.3b-instruct",
    licenseNotice: "Kakao Kanana may require attribution; review its model card and license.",
  },
  {
    vendor: "lg",
    label: "LG AI Research EXAONE",
    textModel: "EXAONE-4.0-1.2B",
    visionModel: "EXAONE-4.5-33B",
    modelCardUrl: "https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B",
    licenseNotice: "EXAONE use may be limited to research or non-commercial purposes.",
  },
  {
    vendor: "skt",
    label: "SK Telecom A.X",
    textModel: "A.X-4.0-Light",
    visionModel: "A.X-4.0-VL-Light",
    modelCardUrl: "https://huggingface.co/skt/A.X-4.0-Light",
    licenseNotice:
      "A.X-4.0-Light is licensed under Apache License 2.0; vision models can require substantial resources.",
  },
];
