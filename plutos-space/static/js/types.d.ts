interface ChartDataset {
  label?: string;
  data: Array<number>;
  backgroundColor?: string | Array<string>;
  borderColor?: string | Array<string>;
  fill?: boolean;
  tension?: number;
  pointBackgroundColor?: string;
}

interface ChartData {
  labels: Array<string>;
  datasets: Array<ChartDataset>;
}

interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: {
      position?: string;
    };
  };
  scales?: {
    y?: {
      beginAtZero?: boolean;
      title?: {
        display?: boolean;
        text?: string;
      };
    };
    x?: {
      title?: {
        display?: boolean;
        text?: string;
      };
    };
  };
}

interface Chart {
  data: ChartData;
  options: ChartOptions;
  update(): void;
}

interface NetworkStats {
  packet_count: number;
  unique_src_ips: number;
  unique_dst_ips: number;
  total_bytes: number;
  protocols?: Array<ProtocolStats>;
  top_sources?: Array<SourceStats>;
  top_destinations?: Array<DestinationStats>;
}

interface ProtocolStats {
  protocol: string;
  packet_count: number;
}

interface SourceStats {
  src_ip: string;
  packet_count: number;
  total_bytes: number;
}

interface DestinationStats {
  dst_ip: string;
  packet_count: number;
  total_bytes: number;
}

interface PacketData {
  timestamp: string;
  src_ip: string;
  dst_ip: string;
  protocol?: string;
  src_port?: number;
  dst_port?: number;
  payload_size?: number;
  is_malicious?: boolean;
  threat_type?: string;
}

interface PacketsResponse {
  packets: Array<PacketData>;
  total_count: number;
  protocols?: Array<string>;
}

interface AlertsResponse {
  alerts: Array<PacketData>;
  total_count: number;
}

interface WebSocketMessage {
  type: string;
  data: any;
} 