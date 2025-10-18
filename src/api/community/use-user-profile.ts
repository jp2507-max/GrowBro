import { createQuery } from 'react-query-kit';

import { getCommunityApiClient } from './client';
import type { UserProfile } from './types';

type Variables = { userId: string };
type Response = UserProfile;

export const useUserProfile = createQuery<Response, Variables, Error>({
  queryKey: ['user-profile'],
  fetcher: async (variables) => {
    const client = getCommunityApiClient();
    return client.getUserProfile(variables.userId);
  },
});
