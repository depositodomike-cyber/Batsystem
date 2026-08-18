// Import Dependencies
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowLongRightIcon,
  ChatBubbleOvalLeftIcon,
  HandThumbUpIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HandThumbUpIcon as HandThumbUpSolidIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Card } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { FEED_ITEMS, type FeedItem } from "@/app/data/feed";
import { useLikesContext } from "@/app/contexts/likes/context";
import { useCommentsContext } from "@/app/contexts/comments/context";

// ----------------------------------------------------------------------

const CATEGORIES = [
  "Home",
  "Cultura",
  "Liderança & Gestão",
  "Produtos",
  "Eventos",
  "Mercado",
  "Tecnologia & IA",
  "Conquistas",
];

// ----------------------------------------------------------------------

export default function Feed() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const base = `/${product.code}/feed`;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Home");

  const query = search.trim().toLowerCase();
  const isFiltering = query !== "" || category !== "Home";

  // Resultado da busca/filtro: por categoria (quando não for "Home") e por
  // texto (título, resumo, autor ou categoria).
  const results = FEED_ITEMS.filter((item) => {
    const matchesCategory = category === "Home" || item.category === category;
    const matchesQuery =
      query === "" ||
      [item.title, item.description, item.author, item.category].some((field) =>
        field.toLowerCase().includes(query),
      );
    return matchesCategory && matchesQuery;
  });

  return (
    <Page title={`Feed · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <CategoryBar
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
          />

          {isFiltering ? (
            <SearchResults
              items={results}
              base={base}
              query={search.trim()}
              category={category}
              onClear={() => {
                setSearch("");
                setCategory("Home");
              }}
            />
          ) : (
            <>
              <HeroSection base={base} />
              <FeaturedPair base={base} />
              <CardGrid
                items={FEED_ITEMS.slice(8, 12)}
                base={base}
                columns={4}
              />
              <CardGrid
                items={FEED_ITEMS.slice(4, 7)}
                base={base}
                columns={3}
              />
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

// ----------------------------------------------------------------------
// Barra de categorias (pills) + busca.

function CategoryBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = cat === category;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={clsx(
                  "text-xs-plus rounded-lg px-3 py-1.5 font-medium transition-colors",
                  isActive
                    ? "bg-primary-600 text-white"
                    : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-600 hover:bg-gray-100",
                )}
              >
                {cat}
              </button>
            );
          })}
        </nav>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="dark:bg-dark-800 dark:border-dark-450 flex w-full max-w-[280px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar no feed"
            className="dark:text-dark-100 dark:placeholder:text-dark-300 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => onSearchChange("")}
              className="dark:text-dark-300 dark:hover:text-dark-100 grid w-8 shrink-0 place-items-center text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="size-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Buscar"
            className="bg-primary-600 hover:bg-primary-700 grid w-10 shrink-0 place-items-center text-white transition-colors"
          >
            <MagnifyingGlassIcon className="size-4" />
          </button>
        </form>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Resultados da busca/filtro.

function SearchResults({
  items,
  base,
  query,
  category,
  onClear,
}: {
  items: FeedItem[];
  base: string;
  query: string;
  category: string;
  onClear: () => void;
}) {
  let label = "";
  if (query) label += ` para “${query}”`;
  if (category !== "Home") label += ` em ${category}`;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="dark:text-dark-200 text-sm text-gray-600">
          <span className="dark:text-dark-50 font-semibold text-gray-800">
            {items.length}
          </span>{" "}
          {items.length === 1 ? "resultado" : "resultados"}
          {label}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="dark:text-dark-300 dark:hover:text-dark-100 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <XMarkIcon className="size-4" />
          Limpar busca
        </button>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <VerticalCard key={item.id} item={item} base={base} />
          ))}
        </div>
      ) : (
        <Card className="dark:text-dark-300 grid place-items-center px-4 py-16 text-center">
          <MagnifyingGlassIcon className="dark:text-dark-400 mb-3 size-8 text-gray-300" />
          <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
            Nenhuma notícia encontrada
          </p>
          <p className="dark:text-dark-300 mt-1 text-sm text-gray-400">
            Tente outro termo ou categoria.
          </p>
        </Card>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------
// Avatar + nome/data do autor e botões de like/comentar (rodapé do card).

function AuthorFooter({ item, base }: { item: FeedItem; base: string }) {
  return (
    <div className="dark:border-dark-500 flex items-center justify-between border-t border-gray-100 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <img
          src={item.face}
          alt={item.author}
          className="size-8 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="dark:text-dark-100 text-xs-plus truncate font-semibold text-gray-800">
            {item.author}
          </p>
          <p className="dark:text-dark-300 text-tiny text-gray-400">
            {item.date}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <LikeButton item={item} />
        <CommentLink item={item} base={base} />
      </div>
    </div>
  );
}

function LikeButton({ item }: { item: FeedItem }) {
  const { isLiked, toggleLike } = useLikesContext();
  const liked = isLiked(item.id);
  const count = item.likes + (liked ? 1 : 0);
  const Icon = liked ? HandThumbUpSolidIcon : HandThumbUpIcon;
  return (
    <button
      type="button"
      aria-label={liked ? "Remover curtida" : "Curtir"}
      aria-pressed={liked}
      onClick={(e) => {
        // Evita disparar a navegação do card.
        e.preventDefault();
        e.stopPropagation();
        toggleLike(item.id);
      }}
      className={clsx(
        "text-xs-plus inline-flex h-8 items-center gap-1 rounded-lg px-2 font-semibold transition-colors",
        liked
          ? "bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300"
          : "dark:bg-dark-600 dark:text-dark-200 dark:hover:bg-dark-500 bg-gray-100 text-gray-500 hover:bg-gray-200",
      )}
    >
      <Icon className="size-4" />
      {count}
    </button>
  );
}

function CommentLink({ item, base }: { item: FeedItem; base: string }) {
  const { commentCount } = useCommentsContext();
  const count = item.comments + commentCount(item.id);
  return (
    <Link
      to={`${base}/${item.id}`}
      aria-label="Comentar"
      onClick={(e) => e.stopPropagation()}
      className="dark:bg-dark-600 dark:text-dark-200 dark:hover:bg-dark-500 text-xs-plus inline-flex h-8 items-center gap-1 rounded-lg bg-gray-100 px-2 font-semibold text-gray-500 transition-colors hover:bg-gray-200"
    >
      <ChatBubbleOvalLeftIcon className="size-4" />
      {count}
    </Link>
  );
}

// ----------------------------------------------------------------------
// Hero: carrossel grande (esquerda) + 3 cards horizontais (direita).

function HeroSection({ base }: { base: string }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="xl:col-span-7">
        <HeroCarousel base={base} />
      </div>
      <div className="flex flex-col gap-2 xl:col-span-5">
        {FEED_ITEMS.slice(3, 6).map((item) => (
          <HorizontalCard
            key={item.id}
            item={item}
            base={base}
            imageSide="left"
            className="flex-1"
          />
        ))}
      </div>
    </div>
  );
}

function HeroCarousel({ base }: { base: string }) {
  const slides = FEED_ITEMS.slice(0, 3);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      2000,
    );
    return () => window.clearInterval(id);
  }, [slides.length]);

  const current = slides[index];

  return (
    <Card className="flex h-full min-h-[360px] flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        {slides.map((item, i) => (
          <Link
            key={item.id}
            to={`${base}/${item.id}`}
            className={clsx(
              "absolute inset-0 block transition-opacity duration-700",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <img
              src={item.image}
              alt={item.title}
              className="size-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-5 text-start">
              <p className="mb-1 text-sm text-white/90">{item.description}</p>
              <h6 className="text-base font-semibold text-white">
                {item.title}
              </h6>
            </div>
          </Link>
        ))}
      </div>
      <AuthorFooter item={current} base={base} />
    </Card>
  );
}

// ----------------------------------------------------------------------
// Card horizontal: imagem de um lado, texto + rodapé do outro.

function HorizontalCard({
  item,
  base,
  imageSide = "left",
  showTitle = false,
  className,
}: {
  item: FeedItem;
  base: string;
  imageSide?: "left" | "right";
  showTitle?: boolean;
  className?: string;
}) {
  // Abaixo de sm o card empilha: com `w-1/3` fixo, em 375px sobravam ~200px
  // para descrição + rodapé (avatar, nome, data, likes). São até 5 destes por
  // render, então era o pior ofensor visual da tela no celular.
  const img = (
    <Link
      to={`${base}/${item.id}`}
      className="h-40 w-full shrink-0 sm:h-auto sm:w-1/3"
    >
      <img
        src={item.image}
        alt={item.title}
        className="size-full object-cover"
      />
    </Link>
  );
  return (
    <Card
      className={clsx("flex flex-col overflow-hidden sm:flex-row", className)}
    >
      {imageSide === "left" && img}
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={`${base}/${item.id}`}
          className="flex flex-1 flex-col px-4 py-3"
        >
          {showTitle && (
            <p className="dark:text-dark-100 hover:text-primary-600 dark:hover:text-primary-400 text-sm-plus mb-1 font-semibold text-gray-800">
              {item.title}
            </p>
          )}
          <p className="dark:text-dark-200 line-clamp-2 text-sm text-gray-600">
            {item.description}
          </p>
        </Link>
        <AuthorFooter item={item} base={base} />
      </div>
      {imageSide === "right" && img}
    </Card>
  );
}

// ----------------------------------------------------------------------
// Par de cards horizontais em destaque (imagem à esquerda / à direita).

function FeaturedPair({ base }: { base: string }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <HorizontalCard
        item={FEED_ITEMS[6]}
        base={base}
        imageSide="left"
        showTitle
      />
      <HorizontalCard
        item={FEED_ITEMS[7]}
        base={base}
        imageSide="right"
        showTitle
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Grade de cards verticais com "Leia mais".

function CardGrid({
  items,
  base,
  columns,
}: {
  items: FeedItem[];
  base: string;
  columns: 3 | 4;
}) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-5 sm:grid-cols-2",
        columns === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {items.map((item) => (
        <VerticalCard key={item.id} item={item} base={base} />
      ))}
    </div>
  );
}

function VerticalCard({ item, base }: { item: FeedItem; base: string }) {
  const to = `${base}/${item.id}`;
  return (
    <Card className="flex flex-col overflow-hidden">
      <Link to={to} className="h-[180px] shrink-0 overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="size-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col px-4 py-3">
        <Link
          to={to}
          className="dark:text-dark-100 hover:text-primary-600 dark:hover:text-primary-400 text-sm-plus mb-1 font-semibold text-gray-800"
        >
          {item.title}
        </Link>
        <p className="dark:text-dark-200 mb-3 flex-1 text-sm text-gray-600">
          {item.description}
        </p>
        <Link
          to={to}
          className="text-primary-600 dark:text-primary-400 inline-flex items-center gap-1 text-sm font-semibold"
        >
          Leia mais
          <ArrowLongRightIcon className="size-4" />
        </Link>
      </div>
      <AuthorFooter item={item} base={base} />
    </Card>
  );
}
