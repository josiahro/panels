import http from '@/api/http';
import { LogsResponse } from '@/components/server/logs/LogsContainer';

export default async (uuid: string): Promise<LogsResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/logs`);

    return data.data || [];
};
