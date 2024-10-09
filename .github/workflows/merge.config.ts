import MarkdownReporter from '../../packages/playwright/lib/reporters/markdown';

export default {
  testDir: '../../tests',
  reporter: [[MarkdownReporter], ['html']]
};