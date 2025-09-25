import { IndexedDBPracticeHistoryStorage } from '../../services/practiceHistory/IndexedDBStorage';

describe('Simple IndexedDB Test', () => {
  it('should create an instance', () => {
    const storage = new IndexedDBPracticeHistoryStorage();
    expect(storage).toBeDefined();
  });
});