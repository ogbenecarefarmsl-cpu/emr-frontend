import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { LabResultReport } from '../../components/reports/LabResultReport';
import { setTokens } from '../../services/api';

export default function PublicLabReportPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const accessToken = searchParams.get('t');
    const refreshToken = searchParams.get('r') || accessToken;

    if (accessToken) {
      setTokens(accessToken, refreshToken || accessToken);
    }

    setIsReady(true);
  }, [searchParams]);

  if (!orderId) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">Order ID is required</div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="p-6">
        <div className="text-center">Preparing report...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LabResultReport orderId={orderId} />
    </div>
  );
}