import { DragEvent } from 'react';
import { useLangStore } from '../../store/language.store';
import './NodePalette.css';

export function NodePalette() {
  const { t } = useLangStore();

  const NODE_ITEMS = [
    {
      category: t.cat_triggers,
      items: [
        { nodeType: 'TRIGGER_WEBHOOK', label: t.node_webhook },
        { nodeType: 'TRIGGER_CRON', label: t.node_cron },
        { nodeType: 'TRIGGER_EMAIL', label: t.node_email_trigger },
      ],
    },
    {
      category: t.cat_actions,
      items: [
        { nodeType: 'ACTION_HTTP_REQUEST', label: t.node_http },
        { nodeType: 'ACTION_EMAIL', label: t.node_email_action },
        { nodeType: 'ACTION_TELEGRAM', label: t.node_telegram },
        { nodeType: 'ACTION_DB_QUERY', label: t.node_db },
        { nodeType: 'ACTION_DATA_TRANSFORM', label: t.node_transform },
      ],
    },
  ];

  const onDragStart = (event: DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ nodeType, label }),
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="node-palette">
      <h4 className="palette-title">{t.nodes_title}</h4>
      {NODE_ITEMS.map((group) => (
        <div key={group.category}>
          <div className="palette-category">{group.category}</div>
          {group.items.map((item) => (
            <div
              key={item.nodeType}
              className={`palette-item ${
                item.nodeType.startsWith('TRIGGER_') ? 'palette-trigger' : 'palette-action'
              }`}
              draggable
              onDragStart={(e) => onDragStart(e, item.nodeType, item.label)}
            >
              {item.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
