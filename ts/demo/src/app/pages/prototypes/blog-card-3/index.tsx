// Local Imports
import { Page } from "@/components/shared/Page";
import { Toolbar } from "./Toolbar";
import { PostCard } from "./PostCard";
import { useFuse } from "@/hooks";
import { Post, posts } from "./data";

export default function BlogCard3() {
  const {
    result: filteredPosts,
    query,
    setQuery,
  } = useFuse<Post>(posts, {
    keys: ["category", "title", "tags", "author.name"],
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  return (
    <Page title="Blog Card 3">
      <div className="transition-content px-(--margin-x) w-full pb-8">
        <Toolbar setQuery={setQuery} query={query} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {filteredPosts.map(({ item: post, refIndex }) => (
            <PostCard
              key={refIndex}
              uid={post.uid}
              cover={post.cover}
              category={post.category}
              title={post.title}
              description={post.description}
              author={post.author}
              tags={post.tags}
              viewCount={post.viewCount}
              created_at={post.created_at}
              query={query}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}
