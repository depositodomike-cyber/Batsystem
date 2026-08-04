// Local Imports
import { Page } from "@/components/shared/Page";
import { Toolbar } from "./Toolbar";
import { UserCard } from "./UserCard";
import { useFuse } from "@/hooks";
import { type User, users } from "./data";

// ----------------------------------------------------------------------

export default function UsersCard4() {
  const {
    result: filteredUsers,
    query,
    setQuery,
  } = useFuse<User>(users, {
    keys: ["name", "position"],
    threshold: 0.2,
    matchAllOnEmptyQuery: true,
  });

  return (
    <Page title="Users Card 4">
      <div className="transition-content w-full px-(--margin-x) pb-8">
        <Toolbar setQuery={setQuery} query={query} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
          {filteredUsers.map(({ item: user, refIndex }) => (
            <UserCard
              key={refIndex}
              uid={user.uid}
              name={user.name}
              avatar={user.avatar}
              position={user.position}
              query={query}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}
