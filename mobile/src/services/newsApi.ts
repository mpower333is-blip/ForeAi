// Backend client for club news / noticeboard. Scoped to the app's club flavour.

import { clubRequest } from "./clubBackend";
import { CLUB } from "../config/appVariant";

export type Notice = {
  id: string;
  clubKey: string;
  title: string;
  body: string;
  category: string; // news | event | notice | result | urgent
  pinned: boolean;
  image: string | null;
  authorName: string | null;
  status: string;
  publishAt: string;
};

// Firestore in club mode (same store as the web portal), Render otherwise.
const j = clubRequest;
const CK = () => CLUB || "kempton";

export const newsApi = {
  list: () => j<Notice[]>(`/news/${CK()}`),
  item: (id: string) => j<Notice>(`/news/${CK()}/item/${id}`),
};
