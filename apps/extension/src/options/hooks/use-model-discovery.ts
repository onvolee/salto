import { useEffect, useRef, useState } from "react";

type ModelDiscoveryState =
  | { status: "idle"; message: "" }
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function useModelDiscovery(apiBaseUrl: string, apiKey: string) {
  const [state, setState] = useState<ModelDiscoveryState>({
    status: "idle",
    message: "",
  });
  const requestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const fetchModels = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ status: "loading", message: "正在获取模型..." });

    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("request failed");

      const payload = (await response.json()) as {
        data?: Array<{ id?: string }>;
      };
      const modelCount = (payload.data ?? []).filter(
        (model): model is { id: string } => Boolean(model.id),
      ).length;

      setState({
        status: "success",
        message: modelCount ? `已获取 ${modelCount} 个模型` : "未找到模型",
      });
    } catch {
      if (controller.signal.aborted) return;
      setState({ status: "error", message: "获取失败，请检查地址和密钥" });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  return {
    fetchModels,
    isLoading: state.status === "loading",
    message: state.message,
  };
}
