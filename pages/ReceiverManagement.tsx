import React from 'react';
import { Navigate } from 'react-router-dom';

// This file is deprecated. Use ReceiverStatus.tsx instead.
export const ReceiverManagement: React.FC = () => {
  return <Navigate to="/receivers" replace />;
};