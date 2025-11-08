/**
 * Synthetic Data Factory for Performance Testing
 *
 * Generates deterministic test data for performance validation:
 * - 1k+ items with mixed types (posts, tasks, calendar events)
 * - Realistic image URLs, BlurHash placeholders, dimensions
 * - Seeded random generation for repeatable tests
 */

// Type definitions (copied from src/types for standalone script)
interface Post {
  id: string;
  userId: string;
  body: string;
  media_uri?: string;
  media_resized_uri?: string;
  media_thumbnail_uri?: string;
  media_blurhash?: string;
  media_thumbhash?: string;
  media_width?: number;
  media_height?: number;
  media_aspect_ratio?: number;
  media_bytes?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  hidden_at?: string;
  moderation_reason?: string;
  undo_expires_at?: string;
  like_count?: number;
  comment_count?: number;
  user_has_liked?: boolean;
}

interface Task {
  id: string;
  seriesId?: string;
  title: string;
  description?: string;
  dueAtLocal: string;
  dueAtUtc: string;
  timezone: string;
  reminderAtLocal?: string;
  reminderAtUtc?: string;
  plantId?: string;
  status: 'pending' | 'completed' | 'skipped';
  position?: number;
  completedAt?: string;
  metadata: Record<string, unknown>;
  serverRevision?: number;
  serverUpdatedAtMs?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface AgendaItem {
  id: string;
  type: 'date-header' | 'task' | 'empty-state';
  date: Date;
  task?: Task;
  height: number;
}

// Simple seeded random number generator (LCG algorithm)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

// Sample BlurHash values for different image types
const SAMPLE_BLURHASHES = [
  'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.', // Green plant
  'L6PZfSi_.AyE_3t7t7R**0o#DgR4', // Purple flower
  'LKO2?U%2Tw=w]~RBVZRi};RPxuwH', // Brown soil
  'LEHV6nWB2yk8pyo0adR*.7kCMdnj', // Light green leaves
  'LNAdAqof00WC5dRjM{s:00t7Rjxu', // Dark green foliage
  'L9H2Ad00Rj~qfQM{R*of00-;WBay', // Yellow-green plant
];

// Sample ThumbHash values (base64 encoded)
const SAMPLE_THUMBHASHES = [
  '1QcSHQRnh493V4dIh4eXh4aSgPcY',
  '2QcSHQRnh493V4dIh4eXh4aSgPcY',
  '3QcSHQRnh493V4dIh4eXh4aSgPcY',
  '4QcSHQRnh493V4dIh4eXh4aSgPcY',
  '5QcSHQRnh493V4dIh4eXh4aSgPcY',
  '6QcSHQRnh493V4dIh4eXh4aSgPcY',
];

// Sample post bodies
const POST_BODIES = [
  'Just harvested my first grow! The buds are looking amazing 🌿',
  'Day 30 of flowering - trichomes are getting cloudy',
  'Switched to 12/12 light cycle today. Excited to see the results!',
  'Added some CalMag to fix the nutrient deficiency',
  'My plants are loving the new LED setup',
  'First time trying LST - results are impressive!',
  'Week 8 of veg, time to flip to flower soon',
  'Just defoliated the lower leaves for better airflow',
  "The smell is getting intense! Can't wait for harvest",
  'Topped my plants today - hoping for bushier growth',
];

// Sample task titles
const TASK_TITLES = [
  'Water plants',
  'Check pH levels',
  'Adjust nutrients',
  'Inspect for pests',
  'Prune lower leaves',
  'Check humidity',
  'Adjust light height',
  'Monitor temperature',
  'Clean grow tent',
  'Check trichomes',
];

// Sample task descriptions
const TASK_DESCRIPTIONS = [
  'Regular watering schedule',
  'Ensure pH is between 6.0-7.0',
  'Add CalMag if needed',
  'Look for spider mites or aphids',
  'Remove yellowing leaves',
  'Keep humidity at 40-60%',
  'Maintain 18-24 inches from canopy',
  'Keep temp between 70-85°F',
  'Wipe down walls and floor',
  "Use jeweler's loupe to inspect",
];

export interface SyntheticDataOptions {
  seed?: number;
  count?: number;
  includeImages?: boolean;
  mixedTypes?: boolean;
}

export interface SyntheticPost extends Post {
  // Additional fields for testing
  _synthetic: true;
}

export interface SyntheticTask extends Task {
  // Additional fields for testing
  _synthetic: true;
}

export interface SyntheticAgendaItem extends AgendaItem {
  // Additional fields for testing
  _synthetic: true;
}

/**
 * Generate synthetic community posts for performance testing
 */
export function generateSyntheticPosts(
  options: SyntheticDataOptions = {}
): SyntheticPost[] {
  const {
    seed = 42,
    count = 1000,
    includeImages = true,
    mixedTypes = true,
  } = options;

  const rng = new SeededRandom(seed);
  const posts: SyntheticPost[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const hasImage = includeImages && (mixedTypes ? rng.next() > 0.3 : true);
    const createdAt = new Date(now - i * 60000).toISOString(); // 1 minute apart

    const post: SyntheticPost = {
      id: `synthetic-post-${i}`,
      userId: `user-${rng.nextInt(1, 50)}`,
      body: rng.choice(POST_BODIES),
      created_at: createdAt,
      updated_at: createdAt,
      like_count: rng.nextInt(0, 100),
      comment_count: rng.nextInt(0, 20),
      user_has_liked: rng.next() > 0.7,
      _synthetic: true,
    };

    if (hasImage) {
      const width = rng.choice([1080, 1280, 1920, 2048]);
      const height = rng.choice([1080, 1280, 1920, 2048]);
      const aspectRatio = width / height;

      post.media_uri = `https://picsum.photos/seed/${i}/${width}/${height}`;
      post.media_resized_uri = `https://picsum.photos/seed/${i}/1280/${Math.round(1280 / aspectRatio)}`;
      post.media_thumbnail_uri = `https://picsum.photos/seed/${i}/200/${Math.round(200 / aspectRatio)}`;
      post.media_blurhash = rng.choice(SAMPLE_BLURHASHES);
      post.media_thumbhash = rng.choice(SAMPLE_THUMBHASHES);
      post.media_width = width;
      post.media_height = height;
      post.media_aspect_ratio = aspectRatio;
      post.media_bytes = rng.nextInt(500000, 5000000); // 500KB - 5MB
    }

    posts.push(post);
  }

  return posts;
}

/**
 * Generate synthetic tasks for performance testing
 */
export function generateSyntheticTasks(
  options: SyntheticDataOptions = {}
): SyntheticTask[] {
  const { seed = 42, count = 1000 } = options;

  const rng = new SeededRandom(seed + 1000); // Different seed for tasks
  const tasks: SyntheticTask[] = [];
  const now = Date.now();
  const timezone = 'America/New_York';

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(now + i * 3600000); // 1 hour apart
    const createdAt = new Date(now - i * 60000).toISOString();
    const status = rng.choice(['pending', 'completed', 'skipped'] as const);

    const task: SyntheticTask = {
      id: `synthetic-task-${i}`,
      title: rng.choice(TASK_TITLES),
      description: rng.choice(TASK_DESCRIPTIONS),
      dueAtLocal: dueDate.toISOString(),
      dueAtUtc: dueDate.toISOString(),
      timezone,
      status,
      position: i,
      metadata: {},
      createdAt,
      updatedAt: createdAt,
      _synthetic: true,
    };

    if (status === 'completed') {
      task.completedAt = new Date(
        dueDate.getTime() + rng.nextInt(0, 3600000)
      ).toISOString();
    }

    if (rng.next() > 0.7) {
      const reminderDate = new Date(dueDate.getTime() - 3600000); // 1 hour before
      task.reminderAtLocal = reminderDate.toISOString();
      task.reminderAtUtc = reminderDate.toISOString();
    }

    tasks.push(task);
  }

  return tasks;
}

/**
 * Generate synthetic agenda items for performance testing
 */
export function generateSyntheticAgendaItems(
  options: SyntheticDataOptions = {}
): SyntheticAgendaItem[] {
  const { seed = 42, count = 1000 } = options;

  const rng = new SeededRandom(seed + 2000); // Different seed for agenda
  const items: SyntheticAgendaItem[] = [];
  const now = Date.now();
  const tasks = generateSyntheticTasks({ seed, count });

  // Add date headers and tasks
  let currentDate = new Date(now);
  let itemIndex = 0;

  for (let i = 0; i < count && itemIndex < tasks.length; i++) {
    // Add date header
    items.push({
      id: `synthetic-date-header-${i}`,
      type: 'date-header',
      date: new Date(currentDate),
      height: 40,
      _synthetic: true,
    });

    // Add 3-5 tasks for this date
    const tasksForDate = rng.nextInt(3, 5);
    for (let j = 0; j < tasksForDate && itemIndex < tasks.length; j++) {
      const task = tasks[itemIndex];
      items.push({
        id: `synthetic-agenda-item-${itemIndex}`,
        type: 'task',
        date: new Date(currentDate),
        task,
        height: 80,
        _synthetic: true,
      });
      itemIndex++;
    }

    // Move to next day
    currentDate = new Date(currentDate.getTime() + 86400000);
  }

  return items;
}

/**
 * Generate mixed synthetic data for heterogeneous list testing
 */
export function generateMixedSyntheticData(
  options: SyntheticDataOptions = {}
): (SyntheticPost | SyntheticTask | SyntheticAgendaItem)[] {
  const { seed = 42, count = 1000 } = options;

  const rng = new SeededRandom(seed + 3000);
  const posts = generateSyntheticPosts({ seed, count: count / 3 });
  const tasks = generateSyntheticTasks({ seed, count: count / 3 });
  const agendaItems = generateSyntheticAgendaItems({ seed, count: count / 3 });

  const mixed: (SyntheticPost | SyntheticTask | SyntheticAgendaItem)[] = [];

  // Interleave items randomly
  const allItems = [...posts, ...tasks, ...agendaItems];
  while (allItems.length > 0 && mixed.length < count) {
    const index = rng.nextInt(0, allItems.length - 1);
    mixed.push(allItems.splice(index, 1)[0]);
  }

  return mixed.slice(0, count);
}

/**
 * Export data to JSON file for Maestro test consumption
 */
export function exportToJSON(
  data: unknown,
  _filename: string = 'synthetic-data.json'
): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Calculate expected memory usage for dataset
 */
export function calculateExpectedMemory(posts: SyntheticPost[]): {
  estimatedMB: number;
  imageCount: number;
  totalBytes: number;
} {
  let totalBytes = 0;
  let imageCount = 0;

  for (const post of posts) {
    // Estimate JSON size
    totalBytes += JSON.stringify(post).length;

    // Add image memory
    if (post.media_bytes) {
      totalBytes += post.media_bytes;
      imageCount++;
    }
  }

  return {
    estimatedMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
    imageCount,
    totalBytes,
  };
}
