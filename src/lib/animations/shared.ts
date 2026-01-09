/** Shared animation helpers used across the application. */
export const strainImageTag = (slug: string): string => `strain-image-${slug}`;

export const communityPostHeroTag = (postId: string): string =>
  `community.post.${postId}.hero`;
