# Community Realtime Usage Guide

## Overview

The Community Realtime Service provides real-time updates for community playbook templates, ratings, and comments. It subscribes ONLY to public community data and never to private user data (tasks, series, etc.).

## Important Security Note

⚠️ **NEVER subscribe to private tables via Realtime:**

- ❌ `tasks` - Use WatermelonDB sync only
- ❌ `series` - Use WatermelonDB sync only
- ❌ `occurrence_overrides` - Use WatermelonDB sync only
- ❌ `notification_queue` - Use WatermelonDB sync only
- ❌ `ph_ec_readings` - Use WatermelonDB sync only

✅ **Only subscribe to community tables:**

- ✅ `community_playbook_templates`
- ✅ `template_ratings`
- ✅ `template_comments`

## Basic Usage

### Using the Hook (Recommended)

```typescript
import { useCommunityRealtime } from '@/lib/playbooks/community-realtime-service';
import { queryClient } from '@/api/common/api-provider';

function CommunityTemplatesScreen() {
  // Subscribe to realtime updates
  useCommunityRealtime({
    onTemplateInsert: (template) => {
      console.log('New template:', template);
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['community-templates'] });
    },
    onTemplateUpdate: (template) => {
      console.log('Template updated:', template);
      // Update specific template in cache
      queryClient.setQueryData(
        ['community-template', template.id],
        template
      );
    },
    onTemplateDelete: (templateId) => {
      console.log('Template deleted:', templateId);
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['community-template', templateId] });
    },
    onRatingChange: (rating) => {
      console.log('Rating changed:', rating);
      // Invalidate template to refetch with new rating
      queryClient.invalidateQueries({
        queryKey: ['community-template', rating.template_id]
      });
    },
    onCommentInsert: (comment) => {
      console.log('New comment:', comment);
      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: ['template-comments', comment.template_id]
      });
    },
  });

  return (
    <View>
      {/* Your component UI */}
    </View>
  );
}
```

### Using the Service Directly

```typescript
import { getCommunityRealtimeService } from '@/lib/playbooks/community-realtime-service';

// Get singleton instance
const realtimeService = getCommunityRealtimeService();

// Subscribe
realtimeService.subscribe({
  onTemplateInsert: (template) => {
    console.log('New template:', template);
  },
  onTemplateUpdate: (template) => {
    console.log('Template updated:', template);
  },
});

// Later, unsubscribe
realtimeService.unsubscribe();

// Check if active
if (realtimeService.isActive()) {
  console.log('Realtime is active');
}
```

## Use Cases

### 1. Community Template Feed

Show new templates as they're published in real-time:

```typescript
function CommunityFeed() {
  const [templates, setTemplates] = React.useState([]);

  useCommunityRealtime({
    onTemplateInsert: (newTemplate) => {
      // Add to top of feed
      setTemplates(prev => [newTemplate, ...prev]);

      // Show toast notification
      showToast({
        title: 'New Template',
        message: `${newTemplate.author_handle} shared a new template`,
      });
    },
  });

  return (
    <FlatList
      data={templates}
      renderItem={({ item }) => <TemplateCard template={item} />}
    />
  );
}
```

### 2. Live Rating Updates

Update rating displays in real-time:

```typescript
function TemplateDetail({ templateId }) {
  const { data: template } = useQuery(['community-template', templateId]);

  useCommunityRealtime({
    onRatingChange: (rating) => {
      if (rating.template_id === templateId) {
        // Refetch template to get updated rating average
        queryClient.invalidateQueries(['community-template', templateId]);
      }
    },
  });

  return (
    <View>
      <Text>Rating: {template.rating_average}/5</Text>
      <Text>({template.rating_count} ratings)</Text>
    </View>
  );
}
```

### 3. Live Comments

Show new comments as they're posted:

```typescript
function TemplateComments({ templateId }) {
  const { data: comments } = useQuery(['template-comments', templateId]);

  useCommunityRealtime({
    onCommentInsert: (comment) => {
      if (comment.template_id === templateId) {
        // Refetch comments
        queryClient.invalidateQueries(['template-comments', templateId]);

        // Scroll to new comment
        scrollToBottom();
      }
    },
    onCommentUpdate: (comment) => {
      if (comment.template_id === templateId) {
        // Update specific comment in cache
        queryClient.setQueryData(
          ['template-comments', templateId],
          (old) => old?.map(c => c.id === comment.id ? comment : c)
        );
      }
    },
    onCommentDelete: (commentId) => {
      // Remove from cache
      queryClient.setQueryData(
        ['template-comments', templateId],
        (old) => old?.filter(c => c.id !== commentId)
      );
    },
  });

  return (
    <FlatList
      data={comments}
      renderItem={({ item }) => <CommentItem comment={item} />}
    />
  );
}
```

### 4. Adoption Counter

Update adoption count in real-time:

```typescript
function TemplateCard({ template }) {
  const [adoptionCount, setAdoptionCount] = React.useState(template.adoption_count);

  useCommunityRealtime({
    onTemplateUpdate: (updated) => {
      if (updated.id === template.id) {
        setAdoptionCount(updated.adoption_count);
      }
    },
  });

  return (
    <View>
      <Text>{template.name}</Text>
      <Text>{adoptionCount} adoptions</Text>
    </View>
  );
}
```

## Performance Considerations

### Subscription Lifecycle

- Subscribe when component mounts
- Unsubscribe when component unmounts
- Use singleton service to avoid duplicate subscriptions

### Optimistic Updates

Combine realtime with optimistic updates for best UX:

```typescript
function RateTemplate({ templateId }) {
  const mutation = useMutation({
    mutationFn: (rating) => rateTemplate(templateId, rating),
    onMutate: async (newRating) => {
      // Optimistic update
      await queryClient.cancelQueries(['community-template', templateId]);
      const previous = queryClient.getQueryData(['community-template', templateId]);

      queryClient.setQueryData(['community-template', templateId], (old) => ({
        ...old,
        rating_average: newRating, // Optimistic
      }));

      return { previous };
    },
    onError: (err, newRating, context) => {
      // Rollback on error
      queryClient.setQueryData(['community-template', templateId], context.previous);
    },
  });

  // Realtime will update with actual server value
  useCommunityRealtime({
    onRatingChange: (rating) => {
      if (rating.template_id === templateId) {
        queryClient.invalidateQueries(['community-template', templateId]);
      }
    },
  });

  return (
    <RatingInput onRate={(rating) => mutation.mutate(rating)} />
  );
}
```

### Debouncing Updates

For high-frequency updates, debounce the invalidation:

```typescript
import { debounce } from 'lodash';

function CommunityFeed() {
  const debouncedInvalidate = React.useMemo(
    () => debounce(() => {
      queryClient.invalidateQueries(['community-templates']);
    }, 1000),
    []
  );

  useCommunityRealtime({
    onTemplateUpdate: () => {
      debouncedInvalidate();
    },
  });

  return <TemplateList />;
}
```

## Error Handling

```typescript
function CommunityScreen() {
  const [realtimeError, setRealtimeError] = React.useState(null);

  React.useEffect(() => {
    const service = getCommunityRealtimeService();

    service.subscribe({
      onTemplateInsert: (template) => {
        try {
          // Handle update
          queryClient.invalidateQueries(['community-templates']);
        } catch (error) {
          console.error('Failed to handle realtime update:', error);
          setRealtimeError(error);
        }
      },
    });

    return () => service.unsubscribe();
  }, []);

  if (realtimeError) {
    return <ErrorView error={realtimeError} />;
  }

  return <TemplateList />;
}
```

## Testing

### Mock Realtime Updates

```typescript
import { getCommunityRealtimeService } from '@/lib/playbooks/community-realtime-service';

jest.mock('@/lib/playbooks/community-realtime-service', () => ({
  getCommunityRealtimeService: jest.fn(() => ({
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    isActive: jest.fn(() => true),
  })),
  useCommunityRealtime: jest.fn(),
}));

test('handles new template', () => {
  const mockSubscribe = jest.fn();
  getCommunityRealtimeService.mockReturnValue({
    subscribe: mockSubscribe,
    unsubscribe: jest.fn(),
    isActive: jest.fn(() => true),
  });

  render(<CommunityFeed />);

  // Get the callback
  const callbacks = mockSubscribe.mock.calls[0][0];

  // Simulate realtime update
  callbacks.onTemplateInsert({ id: '123', name: 'New Template' });

  // Assert UI updated
  expect(screen.getByText('New Template')).toBeOnTheScreen();
});
```

## Troubleshooting

### Subscription Not Working

1. Check Supabase Realtime is enabled in project settings
2. Verify tables are in `supabase_realtime` publication
3. Check RLS policies allow SELECT on community tables
4. Verify network connectivity

### Duplicate Updates

- Ensure only one subscription per component
- Use singleton service pattern
- Unsubscribe on unmount

### Performance Issues

- Debounce high-frequency updates
- Use query invalidation instead of refetching
- Batch multiple updates together

## Best Practices

1. ✅ **Always unsubscribe on unmount**
2. ✅ **Use React Query for cache management**
3. ✅ **Combine with optimistic updates**
4. ✅ **Handle errors gracefully**
5. ✅ **Debounce high-frequency updates**
6. ❌ **Never subscribe to private tables**
7. ❌ **Don't create multiple subscriptions**
8. ❌ **Don't forget to invalidate queries**
