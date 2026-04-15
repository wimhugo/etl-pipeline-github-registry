import React from 'react';
import { Database, Cloud, FileText, Radio, Server } from 'lucide-react';

const iconMap = {
  postgresql: Database,
  mysql: Database,
  mongodb: Database,
  s3: Cloud,
  api: Server,
  csv: FileText,
  kafka: Radio,
  redis: Database,
  bigquery: Cloud,
  snowflake: Cloud,
  elasticsearch: Server,
};

export default function SourceIcon({ type, className = "w-4 h-4" }) {
  const Icon = iconMap[type] || Database;
  return <Icon className={className} />;
}