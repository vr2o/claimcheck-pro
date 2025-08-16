'use client';

import React from 'react';

interface VeracityScoreProps {
  score: number;
  className?: string;
}

function getScoreInterpretation(score: number): {
  text: string;
  color: string;
} {
  if (score >= 90) {
    return {
      text: "This claim appears to be true based on strong evidence",
      color: "text-green-700"
    };
  } else if (score >= 75) {
    return {
      text: "This claim appears to be mostly true based on available evidence",
      color: "text-green-600"
    };
  } else if (score >= 60) {
    return {
      text: "This claim appears to be likely true based on available evidence", 
      color: "text-lime-600"
    };
  } else if (score >= 40) {
    return {
      text: "This claim has mixed evidence and requires further verification",
      color: "text-yellow-600"
    };
  } else if (score >= 25) {
    return {
      text: "This claim appears to be mostly false based on available evidence",
      color: "text-orange-600"
    };
  } else {
    return {
      text: "This claim appears to be false based on available evidence",
      color: "text-red-600"
    };
  }
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'from-green-500 to-green-600';
  if (score >= 60) return 'from-lime-500 to-green-500';
  if (score >= 40) return 'from-yellow-500 to-lime-500';
  if (score >= 25) return 'from-orange-500 to-yellow-500';
  return 'from-red-500 to-orange-500';
}

function getArrowColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 60) return 'text-lime-600';
  if (score >= 40) return 'text-yellow-600';
  if (score >= 25) return 'text-orange-600';
  return 'text-red-600';
}

export function VeracityScore({ score, className = '' }: VeracityScoreProps) {
  const interpretation = getScoreInterpretation(score);
  const position = Math.max(0, Math.min(100, score));
  
  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Interpretation text */}
      <div className="text-center mb-6">
        <h3 className={`text-lg font-semibold ${interpretation.color} mb-2`}>
          {interpretation.text}
        </h3>
        <div className="text-3xl font-bold text-gray-900 mb-1">
          Veracity Score: {score}
        </div>
        <div className="text-sm text-gray-600">
          Based on analysis of available sources
        </div>
      </div>
      
      {/* Score visualization */}
      <div className="relative">
        {/* Background scale */}
        <div className="h-8 rounded-full bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 shadow-inner">
          {/* Animated fill */}
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${getScoreColor(score)} transition-all duration-1000 ease-out shadow-sm`}
            style={{ width: `${position}%` }}
          />
        </div>
        
        {/* Score labels */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span className="font-medium">0</span>
          <span className="font-medium">25</span>
          <span className="font-medium">50</span>
          <span className="font-medium">75</span>
          <span className="font-medium">100</span>
        </div>
        
        {/* Labels under scale */}
        <div className="flex justify-between items-center mt-1 text-xs font-medium">
          <span className="text-red-600">More likely False</span>
          <span className="text-yellow-600">Uncertain</span>
          <span className="text-green-600">More likely True</span>
        </div>
        
        {/* Arrow pointer */}
        <div 
          className="absolute top-[-12px] transition-all duration-1000 ease-out"
          style={{ left: `calc(${position}% - 12px)` }}
        >
          <div className={`w-6 h-6 ${getArrowColor(score)} flex items-center justify-center`}>
            <svg 
              className="w-6 h-6 drop-shadow-sm" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Additional context */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center space-x-4 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>False</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>Mixed</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>True</span>
          </div>
        </div>
      </div>
    </div>
  );
}