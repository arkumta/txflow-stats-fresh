console.log("Starting TxFlow WebSocket test...");

const ws = new WebSocket(
  "wss://testnet-api.txflow-testnet.xyz/api-ws"
);

ws.onopen = () => {
  console.log("Connected to TxFlow");

  const message = {
    method: "subscribe",
subscription: {
  type: "trades",
  coin: "BTC-USDC",
  instrumentId: 1,
}
  };

  console.log("Sending subscription...");
  console.log(JSON.stringify(message, null, 2));

  ws.send(JSON.stringify(message));
};

ws.onmessage = (event) => {
  console.log("Received message:");

  try {
    const message = JSON.parse(event.data);
    console.log(JSON.stringify(message, null, 2));
  } catch {
    console.log(event.data);
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("WebSocket closed");
};