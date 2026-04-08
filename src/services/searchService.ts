import { practiceService } from "./search/practice";
import { profileService } from "./search/profile";
import { researchService } from "./search/research";

export const searchService = {
  ...researchService,
  ...practiceService,
  ...profileService,
};

export type {
  PracticeAnswerSaveParams,
  PracticeSessionRow,
} from "./search/practice";
