'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bell, AlertCircle, Info } from 'lucide-react';
import type { Alert } from '@/lib/doctor-types';
import { generateAlerts, getCohortPatients } from '@/lib/doctor-utils';

interface AlertManagerProps {
  alerts?: Alert[];
}

export function AlertManager({ alerts: propAlerts }: AlertManagerProps) {
  const [filter, setFilter] = useState<'all' | 'CRITICAL' | 'WARNING'>('all');
  
  const alerts = useMemo(() => {
    if (propAlerts) return propAlerts;
    const patients = getCohortPatients();
    return generateAlerts(patients);
  }, [propAlerts]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter(a => a.severity === filter);
  }, [alerts, filter]);

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length;

  const getAlertIcon = (severity: string) => {
    if (severity === 'CRITICAL') {
      return <AlertTriangle size={16} className="text-red-600" />;
    }
    return <AlertCircle size={16} className="text-yellow-600" />;
  };

  const getAlertBg = (severity: string) => {
    if (severity === 'CRITICAL') return 'bg-red-50 border-red-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-orange-600" />
          <h3 className="text-base font-bold text-gray-900">Alertas Activas</h3>
          {criticalCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {criticalCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filter === 'all' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todas ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('CRITICAL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filter === 'CRITICAL' 
              ? 'bg-red-100 text-red-700' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Críticas ({criticalCount})
        </button>
        <button
          onClick={() => setFilter('WARNING')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filter === 'WARNING' 
              ? 'bg-yellow-100 text-yellow-700' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Avisos ({warningCount})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id} 
              className={`p-3 rounded-xl border ${getAlertBg(alert.severity)}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                  alert.severity === 'CRITICAL' ? 'bg-red-100' : 'bg-yellow-100'
                } p-1.5 rounded-lg`}>
                  {getAlertIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {alert.patientName}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      alert.severity === 'CRITICAL' 
                        ? 'bg-red-200 text-red-800' 
                        : 'bg-yellow-200 text-yellow-800'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {alert.type.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Info size={32} className="mb-2" />
            <p className="text-sm">No hay alertas</p>
          </div>
        )}
      </div>
    </div>
  );
}
