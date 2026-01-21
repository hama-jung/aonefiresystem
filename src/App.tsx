import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UserManagement } from './pages/UserManagement';
import { MarketManagement } from './pages/MarketManagement';
import { StoreManagement } from './pages/StoreManagement';
import { RoleManagement } from './pages/RoleManagement';
import { DistributorManagement } from './pages/DistributorManagement';
import { SmsTransmission } from './pages/SmsTransmission';
import { WorkLogManagement } from './pages/WorkLogManagement';
import { ReceiverManagement } from './pages/ReceiverManagement';
import { RepeaterManagement } from './pages/RepeaterManagement';
import { MenuManagement } from './pages/MenuManagement';
import { DetectorManagement } from './pages/DetectorManagement';
import { TransmitterManagement } from './pages/TransmitterManagement';
import { AlarmManagement } from './pages/AlarmManagement';
import { CommonCodeManagement } from './pages/CommonCodeManagement';
import { FireHistoryManagement } from './pages/FireHistoryManagement';
import { DeviceStatusManagement } from './pages/DeviceStatusManagement';
import { DataReceptionManagement } from './pages/DataReceptionManagement';
import { UartCommunication } from './pages/UartCommunication';

// Placeholder components for routes not fully implemented
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div className="p-8 text-center text-gray-500">
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <p>이 페이지는 현재 준비 중입니다.</p>
  </div>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes Wrapper */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/markets" element={<MarketManagement />} />
              
              {/* Actual Components linked to routes */}
              <Route path="/stores" element={<StoreManagement />} />
              <Route path="/roles" element={<RoleManagement />} />
              <Route path="/distributors" element={<DistributorManagement />} />
              <Route path="/sms" element={<SmsTransmission />} />
              <Route path="/work-logs" element={<WorkLogManagement />} />
              <Route path="/receivers" element={<ReceiverManagement />} />
              <Route path="/repeaters" element={<RepeaterManagement />} />
              <Route path="/menus" element={<MenuManagement />} />
              <Route path="/detectors" element={<DetectorManagement />} />
              <Route path="/transmitters" element={<TransmitterManagement />} />
              <Route path="/alarms" element={<AlarmManagement />} />
              <Route path="/common-codes" element={<CommonCodeManagement />} />
              
              {/* Data Management Routes */}
              <Route path="/fire-history" element={<FireHistoryManagement />} />
              <Route path="/device-status" element={<DeviceStatusManagement />} />
              <Route path="/data-reception" element={<DataReceptionManagement />} />
              <Route path="/uart-communication" element={<UartCommunication />} />
              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;