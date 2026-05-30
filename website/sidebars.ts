import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    'cli',
    {
      type: 'category',
      label: 'Data model',
      items: ['model/data-model', 'model/field-types', 'model/picklists'],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/master-detail',
        'features/history-tracking',
        'features/object-features',
        'features/standard-objects',
        'features/record-types',
      ],
    },
    'deployment',
  ],
};

export default sidebars;
