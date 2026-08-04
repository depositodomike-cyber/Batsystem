// Local Imports
import { Page } from "@/components/shared/Page";
import { Toolbar } from "./Toolbar";
import { PostCard } from "./PostCard";
import { useFuse } from "@/hooks";
import { type Post, posts } from "./data";

export default function BlogCard1() {
  const {
    result: filteredPosts,
    query,
    setQuery,
  } = useFuse<Post>(posts, {
    keys: ["category", "title", "author_name"],
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  return (
    <Page title="Blog Card 1">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <Toolbar setQuery={setQuery} query={query} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
          {filteredPosts.map(({ item: post, refIndex }) => (
            <PostCard key={refIndex} query={query} {...post} />
          ))}
        </div>
      </div>
    </Page>
  );
}
