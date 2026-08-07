import { ProfileMenu } from "@/components/template/ProfileMenu";

export function Profile() {
  return (
    <ProfileMenu
      avatarSize={12}
      anchor="right end"
      transitionFrom="translate-x-2"
    />
  );
}
