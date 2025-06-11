"use client";

import { Badge } from "@/components/ui/badge";
import { User, Database, Truck, Globe } from "lucide-react";

interface SourceBadgeProps {
  sourceType: string;
  confidenceScore?: number;
  className?: string;
  showIcon?: boolean;
  showScore?: boolean;
}

const sourceConfig = {
  manual: {
    label: "Manual",
    icon: User,
    className: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Manually entered by user"
  },
  integration: {
    label: "Integration",
    icon: Database,
    className: "bg-green-100 text-green-800 border-green-200",
    description: "From your product data (PrestaShop, etc.)"
  },
  supplier: {
    label: "Supplier",
    icon: Truck,
    className: "bg-orange-100 text-orange-800 border-orange-200",
    description: "From supplier feeds or CSV uploads"
  },
  competitor: {
    label: "Competitor",
    icon: Globe,
    className: "bg-purple-100 text-purple-800 border-purple-200",
    description: "From competitor scraping"
  }
};

export function SourceBadge({ 
  sourceType, 
  confidenceScore, 
  className = "", 
  showIcon = true, 
  showScore = false 
}: SourceBadgeProps) {
  const config = sourceConfig[sourceType as keyof typeof sourceConfig];
  
  if (!config) {
    return (
      <Badge variant="outline" className={`text-xs ${className}`}>
        Unknown
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`text-xs ${config.className} ${className}`}
      title={config.description}
    >
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
      {showScore && confidenceScore && (
        <span className="ml-1 opacity-75">({confidenceScore}%)</span>
      )}
    </Badge>
  );
}

export function getSourcePriority(sourceType: string): number {
  const priorities = {
    manual: 100,
    integration: 80,
    supplier: 60,
    competitor: 40
  };
  
  return priorities[sourceType as keyof typeof priorities] || 0;
}

export function getSourceLabel(sourceType: string): string {
  const config = sourceConfig[sourceType as keyof typeof sourceConfig];
  return config?.label || sourceType;
}

export function getSourceDescription(sourceType: string): string {
  const config = sourceConfig[sourceType as keyof typeof sourceConfig];
  return config?.description || `Data from ${sourceType} source`;
}
