"""R2Flow — Free Python RPA engine for creating automation bots."""

from r2flow.core.config import Config, load_config
from r2flow.core.errors import (
    BusinessError,
    Cancelled,
    ConfigError,
    ElementNotFound,
    InfrastructureError,
    InvalidInput,
    PlatformError,
    ToolError,
)
from r2flow.core.http_queue import HttpQueue, HttpQueueError
from r2flow.core.logging import JsonlEventLogger
from r2flow.core.queue import (
    ClaimedItem,
    InMemoryQueue,
    LeaseRenewable,
    Queue,
    QueueInfo,
    QueueItem,
    SqliteQueue,
)
from r2flow.core.retry import RetryTool
from r2flow.core.schema import validate_against_schema
from r2flow.core.selectors import SelectorStore
from r2flow.core.tool import AbstractTool, Tool, tool
from r2flow.core.transactions import (
    ItemOutcome,
    TransactionContextMiddleware,
    TransactionReport,
    current_transaction_id,
    run_transactions,
    run_transactions_async,
)
from r2flow.facade import (
    ClickResult,
    InputTextResult,
    ProcessHandle,
    SetTextResult,
    R2Flow,
)
from r2flow.flow import FlowError, FlowRunner
from r2flow.pack import (
    PACK_MANIFEST,
    TEMPLATE_FILE,
    build_pack,
    fetch_pack,
    load_manifest,
    load_template,
    publish_pack,
    validate_template,
    verify_pack,
    zip_pack,
)

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("r2flow-engine")
except PackageNotFoundError:  # pragma: no cover — running from an uninstalled tree
    __version__ = "0.8.11"

__all__ = [
    "AbstractTool",
    "BusinessError",
    "Cancelled",
    "ClaimedItem",
    "ClickResult",
    "Config",
    "ConfigError",
    "ElementNotFound",
    "FlowError",
    "FlowRunner",
    "HttpQueue",
    "HttpQueueError",
    "InMemoryQueue",
    "InputTextResult",
    "InvalidInput",
    "ItemOutcome",
    "JsonlEventLogger",
    "LeaseRenewable",
    "PACK_MANIFEST",
    "PlatformError",
    "ProcessHandle",
    "Queue",
    "QueueInfo",
    "QueueItem",
    "RetryTool",
    "SelectorStore",
    "SetTextResult",
    "R2Flow",
    "SqliteQueue",
    "InfrastructureError",
    "TEMPLATE_FILE",
    "Tool",
    "ToolError",
    "TransactionContextMiddleware",
    "TransactionReport",
    "build_pack",
    "current_transaction_id",
    "fetch_pack",
    "load_config",
    "load_manifest",
    "load_template",
    "publish_pack",
    "run_transactions",
    "run_transactions_async",
    "tool",
    "validate_against_schema",
    "validate_template",
    "verify_pack",
    "zip_pack",
]
