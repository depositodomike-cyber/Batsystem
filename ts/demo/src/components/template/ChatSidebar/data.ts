// Dados fake do painel de Chat (Favoritos, Canais, Mensagens Diretas).

export interface ChannelItem {
  id: string;
  type: "channel";
  name: string;
  preview: string;
  unread?: number;
}

export interface DirectItem {
  id: string;
  type: "direct";
  name: string;
  avatar: string;
  preview: string;
  isOnline?: boolean;
  unread?: number;
}

export type ChatItem = ChannelItem | DirectItem;

export const favorites: ChatItem[] = [
  {
    id: "fav-geral",
    type: "channel",
    name: "geral",
    preview: "Ana: bom dia, time! ☀️",
    unread: 3,
  },
  {
    id: "fav-ana",
    type: "direct",
    name: "Ana Souza",
    avatar: "/images/avatar/avatar-1.jpg",
    preview: "Pode revisar o doc?",
    isOnline: true,
  },
  {
    id: "fav-anuncios",
    type: "channel",
    name: "anúncios",
    preview: "Nova política de férias",
  },
];

export const channels: ChannelItem[] = [
  {
    id: "ch-geral",
    type: "channel",
    name: "geral",
    preview: "Ana: bom dia, time! ☀️",
    unread: 3,
  },
  {
    id: "ch-comercial",
    type: "channel",
    name: "comercial",
    preview: "Carlos fechou o contrato 🎉",
    unread: 12,
  },
  {
    id: "ch-marketing",
    type: "channel",
    name: "marketing",
    preview: "Campanha sai na sexta",
  },
  {
    id: "ch-design",
    type: "channel",
    name: "design",
    preview: "Novos ícones no Figma",
  },
  {
    id: "ch-aleatorio",
    type: "channel",
    name: "aleatório",
    preview: "Alguém para o almoço?",
  },
];

// ----------------------------------------------------------------------
// Mensagens fake de uma conversa (canal ou DM).

export interface ConvMessage {
  id: number;
  author: "me" | "them";
  name: string;
  avatar?: string;
  text: string;
  time: string;
  /** Marcada como "combinado" (acordo/decisão). */
  agreement?: boolean;
}

export function getConversation(item: ChatItem): ConvMessage[] {
  const them =
    item.type === "direct" ? item.name : "Ana Souza";
  const themAvatar =
    item.type === "direct" ? item.avatar : "/images/avatar/avatar-1.jpg";

  return [
    {
      id: 1,
      author: "them",
      name: them,
      avatar: themAvatar,
      text: "Oi! Tudo certo para a entrega de hoje?",
      time: "09:12",
    },
    {
      id: 2,
      author: "me",
      name: "Você",
      avatar: "/images/avatar/avatar-20.jpg",
      text: "Tudo sim, só finalizando os últimos ajustes.",
      time: "09:14",
    },
    {
      id: 3,
      author: "them",
      name: them,
      avatar: themAvatar,
      text: "Perfeito. Conseguimos publicar até as 17h?",
      time: "09:15",
    },
    {
      id: 4,
      author: "me",
      name: "Você",
      avatar: "/images/avatar/avatar-20.jpg",
      text: "Fechado, publico até as 17h e te aviso aqui.",
      time: "09:16",
      agreement: true,
    },
    {
      id: 5,
      author: "them",
      name: them,
      avatar: themAvatar,
      text: "Combinado! Obrigada 🙌",
      time: "09:16",
      agreement: true,
    },
  ];
}

export const directMessages: DirectItem[] = [
  {
    id: "dm-ana",
    type: "direct",
    name: "Ana Souza",
    avatar: "/images/avatar/avatar-1.jpg",
    preview: "Pode revisar o doc?",
    isOnline: true,
    unread: 2,
  },
  {
    id: "dm-carlos",
    type: "direct",
    name: "Carlos Lima",
    avatar: "/images/avatar/avatar-6.jpg",
    preview: "Te chamo daqui a pouco",
    isOnline: true,
  },
  {
    id: "dm-beatriz",
    type: "direct",
    name: "Beatriz Nunes",
    avatar: "/images/avatar/avatar-4.jpg",
    preview: "Obrigada! 🙌",
    isOnline: false,
  },
  {
    id: "dm-diego",
    type: "direct",
    name: "Diego Martins",
    avatar: "/images/avatar/avatar-10.jpg",
    preview: "Bora marcar a call",
    isOnline: true,
  },
  {
    id: "dm-eduarda",
    type: "direct",
    name: "Eduarda Reis",
    avatar: "/images/avatar/avatar-15.jpg",
    preview: "Vejo amanhã 👋",
    isOnline: false,
  },
  {
    id: "dm-felipe",
    type: "direct",
    name: "Felipe Costa",
    avatar: "/images/avatar/avatar-18.jpg",
    preview: "Enviei o arquivo",
    isOnline: false,
  },
];
