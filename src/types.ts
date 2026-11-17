export interface BackstagePhoto {
  id: string;
  url: string;
  caption: string;
}

export interface WishlistItem {
  id: string;
  title: string;
  url?: string;
  price?: string;
}

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  tgUsername?: string;
  wishlist: string;
  wishlistItems: WishlistItem[];
  antiWishlist: string;
  antiWishlistTags: string[];
  hobbies: string[];
  clothingSize?: string;
  isHost: boolean;
  isReady: boolean;
  online: boolean;
  checkedIn?: boolean;
}

export interface PublicParticipant {
  id: string;
  name: string;
  avatar: string;
  tgUsername?: string;
  hobbies: string[];
  hasWishlist: boolean;
  hasAntiWishlist: boolean;
  isHost: boolean;
  isReady: boolean;
  online: boolean;
  checkedIn?: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number; // 0..options.length-1
  explanation: string;
  category: string;
  isCustom?: boolean;
  authorName?: string;
}

export interface ActiveQuizState {
  questionIndex: number; // 0, 1, 2
  totalQuestions: number; // e.g. 3
  currentQuestion: QuizQuestion;
  answers: Record<string, number>; // participantId -> optionIndex (0..options.length-1)
  answersCount: number;
  correctParticipantIds: string[];
  isLastInBatch: boolean;
  nextStepAfterQuiz: 'roulette' | 'finished';
}

export type PartyStep =
  | 'lobby'
  | 'countdown'
  | 'question_builder'
  | 'quiz_question'
  | 'quiz_reveal'
  | 'roulette'
  | 'riddle'
  | 'guess'
  | 'photos'
  | 'reveal'
  | 'finished';

export interface ReactionEvent {
  id: string;
  emoji: string;
  sound: string;
  senderName: string;
  timestamp: number;
}

export interface EndgameNominations {
  sherlock?: { participant: PublicParticipant; count: number } | null;
  watson?: { participant: PublicParticipant; count: number } | null;
  ninja?: { participant: PublicParticipant; guessedCount: number } | null;
  openBook?: { participant: PublicParticipant; guessedCount: number } | null;
  soundboardKing?: { participant: PublicParticipant; count: number } | null;
  quizMaster?: { participant: PublicParticipant; count: number } | null;
  totalGifts: number;
  totalGuesses: number;
  accuracyPercent: number;
}

export interface ClientRoomView {
  code: string;
  title: string;
  budget: string;
  eventDate: string;
  hostId: string;
  status: 'lobby' | 'drawn' | 'party';
  participants: PublicParticipant[];
  myRecipient?: {
    participant: Participant;
    pairId: string;
    hintRiddle: string;
    backstagePhotos: BackstagePhoto[];
  } | null;
  myProfile?: Participant | null;
  party: {
    status: 'not_started' | 'active' | 'finished';
    currentStep: PartyStep;
    timer: number;
    stepStartTime: number;
    timerDuration: number;
    currentPairIndex: number;
    totalPairs: number;
    currentReceiver?: PublicParticipant | null;
    currentGiverId?: string | null;
    currentRiddle?: string | null;
    currentPhotos?: BackstagePhoto[] | null;
    revealedGiver?: PublicParticipant | null;
    guessesCount: number;
    votedParticipantIds: string[];
    scores: Record<string, number>;
    quiz?: ActiveQuizState | null;
    nominations?: EndgameNominations | null;
    builderStatus?: Record<string, 'composing' | 'submitted' | 'skipped'>;
  };
  recentReactions: ReactionEvent[];
}
