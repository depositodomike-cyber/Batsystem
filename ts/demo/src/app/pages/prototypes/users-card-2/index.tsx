import { Page } from "@/components/shared/Page";
import { useFuse } from "@/hooks";
import { Toolbar } from "./Toolbar";
import { UserCard } from "./UserCard";
import { User, users } from "./data";

export default function UsersCard2() {
  const {
    result: filteredUsers,
    query,
    setQuery,
  } = useFuse<User>(users, {
    keys: ["name", "location"],
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  return (
    <Page title="Users Card 2">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <Toolbar setQuery={setQuery} query={query} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
          {filteredUsers.map(({ item: user, refIndex }) => (
            <UserCard
              key={refIndex}
              uid={user.uid}
              avatar={user.avatar}
              cover={user.cover}
              color={user.color}
              socialLinks={user.socialLinks}
              name={user.name}
              query={query}
              chartData={user.chartData}
              location={user.location}
              postsCount={user.postsCount}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}
