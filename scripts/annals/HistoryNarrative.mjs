import contract from './HistoryNarrative.js';
import {validateBoundHistory} from './BoundHistory.mjs';
import {historyDigest} from './HistoryPublisher.mjs';

export const narrativeReviewDigest=(current,proposal,evidence)=>
  contract.narrativeReviewDigest(current,proposal,evidence,historyDigest);
export const stageHistoryNarrative=input=>contract.stageHistoryNarrative(input,historyDigest,validateBoundHistory);
