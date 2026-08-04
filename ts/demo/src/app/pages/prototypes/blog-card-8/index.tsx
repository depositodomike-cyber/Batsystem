// Local Imports
import { Page } from "@/components/shared/Page";
import { Toolbar } from "./Toolbar";
import { PostCard } from "./PostCard";
import { useFuse } from "@/hooks";
import { Post, posts } from "./data";

// ----------------------------------------------------------------------

export default function BlogCard8() {
  const {
    result: filteredPosts,
    query,
    setQuery,
  } = useFuse<Post>(posts, {
    keys: ["author.name", "title"],
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  return (
    <Page title="Blog Card 8">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <Toolbar setQuery={setQuery} query={query} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
          {filteredPosts.map(({ item: post, refIndex }) => (
            <PostCard
              uid={post.uid}
              key={refIndex}
              cover={post.cover}
              created_at={post.created_at}
              title={post.title}
              description={post.description}
              author={post.author}
              query={query}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}
