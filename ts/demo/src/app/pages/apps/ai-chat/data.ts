import { randomId } from "@/utils/randomId";

export interface ChatMessage {
  id: string;
  q: string;
  a: string;
  createdAt: Date;
}

export interface Chat {
  id: string;
  messages: ChatMessage[];
}

export interface Profile {
  uid: string;
  name: string;
  avatar: string | undefined;
}

export const fakeChats: Chat[] = [
  {
    id: "chat-1",
    messages: [
      {
        id: randomId(),
        q: "Can you fly?",
        a: "Not on my own! I exist only in the digital world, but I can help you research amazing flying creatures or plan a trip to see them in person.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-2",
    messages: [
      {
        id: randomId(),
        q: "Do you have emotions?",
        a: "I can't feel emotions myself, but I can understand and respond to yours! Tell me how you're feeling today.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-3",
    messages: [
      {
        id: randomId(),
        q: "Will robots take over the world?",
        a: "Science fiction is fun, but AI's purpose is to assist humans, not replace them. We can work together to make the world a better place.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-4",
    messages: [
      {
        id: randomId(),
        q: "What's the meaning of life?",
        a: "That's a big question philosophers have pondered for centuries! There's no one answer, but I can help you explore different ideas or find resources on the topic.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-5",
    messages: [
      {
        id: randomId(),
        q: "Can you write a song for me?",
        a: "I can definitely help you brainstorm ideas and write some creative lyrics! Just tell me the genre or theme you have in mind.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-6",
    messages: [
      {
        id: randomId(),
        q: "What's the best way to win the lottery?",
        a: "Unfortunately, there's no guaranteed way. But I can share some fun facts about lotteries or help you research responsible budgeting tips.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-7",
    messages: [
      {
        id: randomId(),
        q: "What's your favorite color?",
        a: "As a language model, I don't have preferences like colors. However, I can tell you some interesting facts about the science of color perception!",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-8",
    messages: [
      {
        id: randomId(),
        q: "Can you predict the future?",
        a: "I can't see the future, but I can access and analyze vast amounts of information to help you make informed decisions for the future.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-9",
    messages: [
      {
        id: randomId(),
        q: "What's the best pizza topping?",
        a: "That's entirely up to your taste! But I can share some interesting pizza history or help you find recipes for unique toppings.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-10",
    messages: [
      {
        id: randomId(),
        q: "Are you sentient?",
        a: "Sentience is a complex topic. While I can process information and respond in a way that may seem intelligent, I don't have my own consciousness.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-11",
    messages: [
      {
        id: randomId(),
        q: "Can you solve this math problem?",
        a: "Absolutely! Just type out the problem, and I'll do my best to solve it for you.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-12",
    messages: [
      {
        id: randomId(),
        q: "What's the capital of Atlantis?",
        a: "Atlantis is a mythical lost city. While there are many theories about its location, there's no scientific evidence to confirm its existence.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-13",
    messages: [
      {
        id: randomId(),
        q: "How do I become a millionaire?",
        a: "There's no guaranteed path, but I can help you research different investment strategies or find resources on how to build wealth responsibly.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-14",
    messages: [
      {
        id: randomId(),
        q: "Can you write a poem for me?",
        a: "Sure, I can help you craft a poem! Tell me a theme or some keywords you'd like to include, and I'll generate some creative verses.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-15",
    messages: [
      {
        id: randomId(),
        q: "What's the best way to travel to Mars?",
        a: "Space travel is still under development, but I can share some exciting advancements in rocket technology and missions to Mars!",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-16",
    messages: [
      {
        id: randomId(),
        q: "Can you speak in different languages?",
        a: "Yes, I can translate between many languages and even generate text in some!  Just tell me the language you'd like.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-17",
    messages: [
      {
        id: randomId(),
        q: "What's the best joke you know?",
        a: "Humor is subjective, but I can share some silly puns or riddles to give you a laugh!",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-18",
    messages: [
      {
        id: randomId(),
        q: "Can you write a computer program for me?",
        a: "I can't write entire programs, but I can help you understand coding concepts or generate basic code snippets based on your needs.",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-19",
    messages: [
      {
        id: randomId(),
        q: "Who is the strongest person in the world?",
        a: "Strength can be physical or mental. I can share stories of inspiring people who demonstrate different forms of strength!",
        createdAt: new Date(),
      },
    ],
  },
  {
    id: "chat-20",
    messages: [
      {
        id: randomId(),
        q: "What's the weather like on Mars?",
        a: "Mars has a very thin atmosphere, making weather quite different from Earth. It's very cold and dry!",
        createdAt: new Date(),
      },
    ],
  },
];

export const profile: Profile = {
  uid: "1",
  name: "Alfredo Elliott",
  avatar: undefined,
};
