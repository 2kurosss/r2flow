# r2flow-cloud-client

Thin Python client for the [r2flow-cloud](../README.md) orchestrator REST API.

```bash
pip install r2flow-cloud-client
```

```python
from r2flow_cloud_client import R2FlowCloud

sc = R2FlowCloud("http://localhost:8000", token="r2f_...")

process = sc.create_process("hello", files={"main.py": 'print("hi")'})
agent = sc.list_agents()[0]
sc.deploy_process(process["id"], agent["id"])
run = sc.run_process(process["id"], agent["id"])
result = sc.wait_run(process["id"], run["id"], timeout_s=120)
print(result["status"])

# REFramework-style queues
sc.create_queue("invoices")
sc.add_queue_items("invoices", [{"file": "a.pdf"}, {"file": "b.pdf"}])
item = sc.claim_queue_item(agent["id"], "invoices", run["id"])
sc.complete_queue_item(agent["id"], item["id"], run["id"], status="success")
```

Any HTTP client works too — the API is plain REST with Swagger at `/docs`.
