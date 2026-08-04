// Import Dependencies
import { Page } from "@/components/shared/Page";
import { Toolbar } from "./Toolbar";
import { PostCard } from "./PostCard";
import { useFuse } from "@/hooks";
import { Post, posts } from "./data";

// ----------------------------------------------------------------------

export default function BlogCard5() {
  const {
    result: filteredPosts,
    query,
    setQuery,
  } = useFuse<Post>(posts, {
    keys: ["category", "title"],
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  return (
    <Page title="Blog Card 5">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <Toolbar setQuery={setQuery} query={query} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {filteredPosts.map(({ item: post, refIndex }) => (
            <PostCard
              uid={post.uid}
              key={refIndex}
              cover={post.cover}
              category={post.category}
              CategoryIcon={post.CategoryIcon}
              title={post.title}
              created_at={post.created_at}
              query={query}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}
