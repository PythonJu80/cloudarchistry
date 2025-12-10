"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  DollarSign, 
  Trophy, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { JourneyHistory } from "./types";

interface JourneyHistoryProps {
  history: JourneyHistory[];
  onDeleteJourney: (journeyId: string) => void;
  onClearHistory: () => void;
}

export function JourneyHistoryDisplay({ history, onDeleteJourney, onClearHistory }: JourneyHistoryProps) {
  const [expandedJourney, setExpandedJourney] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-12 max-w-4xl mx-auto text-center text-slate-400"
      >
        <p>No journey history yet. Complete your first journey to see it here!</p>
      </motion.div>
    );
  }

  const toggleExpanded = (journeyId: string) => {
    setExpandedJourney(expandedJourney === journeyId ? null : journeyId);
  };

  const getOutcomeIcon = (outcome: 'success' | 'partial' | 'failed') => {
    switch (outcome) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getOutcomeColor = (outcome: 'success' | 'partial' | 'failed') => {
    switch (outcome) {
      case 'success':
        return 'text-green-400';
      case 'partial':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-12 max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-slate-300">Journey History</h3>
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearHistory}
            className="text-slate-400 border-slate-600 hover:text-red-400 hover:border-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {history.slice().reverse().map((journey, index) => (
          <motion.div
            key={journey.journeyId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-white mb-1">{journey.journeyName}</h4>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(journey.completedAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">${journey.totalEarnings.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-400">{journey.perfectMatches} perfect</span>
                    </div>
                    <div className="text-slate-500">
                      {journey.businesses.length}/{journey.totalBusinesses} businesses
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(journey.journeyId)}
                    className="text-slate-400 hover:text-white"
                  >
                    {expandedJourney === journey.journeyId ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteJourney(journey.journeyId)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {expandedJourney === journey.journeyId && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 pt-4 border-t border-slate-700"
                >
                  <h5 className="text-sm font-medium text-slate-300 mb-3">Business Results</h5>
                  <div className="grid gap-2">
                    {journey.businesses.map((business, businessIndex) => (
                      <div
                        key={`${business.businessId}-${businessIndex}`}
                        className="flex items-center justify-between p-2 bg-slate-900/50 rounded"
                      >
                        <div className="flex items-center gap-2">
                          {getOutcomeIcon(business.outcome)}
                          <span className="text-sm text-slate-300">{business.businessName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${getOutcomeColor(business.outcome)}`}>
                            {business.outcome.charAt(0).toUpperCase() + business.outcome.slice(1)}
                          </span>
                          <span className="text-sm text-green-400">
                            +${business.earnings.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
