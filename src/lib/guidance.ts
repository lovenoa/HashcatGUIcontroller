export interface Guidance {
  short: string;
  detail: string;
}

const guidance: Record<string, Guidance> = {
  hashMode: {
    short: "指定哈希算法；不确定时可让 hashcat 自动识别。",
    detail: "模式 ID 必须与哈希格式一致。可先用 --identify 查看候选，再参考算法库中的示例。"
  },
  attackMode: {
    short: "决定候选密码的生成方式，不是哈希算法。",
    detail: "字典和规则适合已有词表；掩码适合已知密码结构；组合、混合和关联用于组合已有信息。"
  },
  hashFile: {
    short: "每行一个待处理哈希；复杂文件格式通常需要先转换。",
    detail: "导入后检查无效行、重复项和用户名字段。档案、文档、磁盘容器等文件不能直接作为哈希列表。"
  },
  wordlist: {
    short: "候选密码来源，可以是词表文件或目录。",
    detail: "多个词表会依次处理。路径中可以包含空格，启动时通过参数数组传递，不经过 Shell。"
  },
  rules: {
    short: "规则会变换词表候选，例如大小写、追加数字或替换字符。",
    detail: "hashcat 7.1.2 中 -r 适用于攻击模式 0 和 9。多个规则文件按笛卡尔积组合，数量增长很快。"
  },
  mask: {
    short: "逐位置限制候选字符，例如 ?u?l?l?l?d?d?d?d。",
    detail: "?l 小写、?u 大写、?d 数字、?s 特殊字符、?a 可打印 ASCII、?b 全字节；?? 表示字面问号。"
  },
  customCharset: {
    short: "定义 ?1 到 ?8 可引用的自定义字符集。",
    detail: "可直接输入字符、组合内置字符集，或引用 .hcchr 文件。掩码位置通过 ?1 至 ?8 使用。"
  },
  markov: {
    short: "调整候选排列顺序，让常见字符组合更早出现。",
    detail: "Markov 不缩小完整键空间，只改变尝试顺序。阈值越低，越偏向高概率组合。"
  },
  optimizedKernel: {
    short: "更快，但会限制密码长度并影响部分 UTF-16 场景。",
    detail: "只有确认哈希模式、密码长度和编码兼容时才启用。复杂 Unicode 建议使用纯内核。"
  },
  workloadProfile: {
    short: "在速度、响应性和功耗之间选择运行强度。",
    detail: "1 适合低干扰，2 为默认，3 适合独占运行，4 仅适合无交互的主机。"
  },
  restore: {
    short: "从已有 checkpoint 会话继续，不能顺便修改原参数。",
    detail: "优先使用 checkpoint 停止。强制退出可能丢失最近进度；恢复时必须保留原文件、规则和掩码。"
  },
  potfile: {
    short: "记录已经恢复的哈希，避免以后重复计算。",
    detail: "potfile 属于敏感数据。禁用后结果只进入当前输出；自定义路径便于按项目隔离。"
  },
  keepGuessing: {
    short: "找到答案后继续尝试，用于一个哈希对应多个明文的场景。",
    detail: "会增加运行时间，并且重复明文可能只报告一次。普通任务不建议启用。"
  },
  brain: {
    short: "跨多次攻击去重候选，不是任务调度或词表分发系统。",
    detail: "client 会启用 slow candidates，并向 Brain 发送候选哈希或攻击位置。密码和网络地址需要谨慎管理。"
  },
  bridge: {
    short: "把部分计算交给 Python、Rust 或其他桥接实现。",
    detail: "模式 72000、73000、74000 的行为由插件决定。Windows 的 Python 桥接通常使用单进程模式。"
  },
  force: {
    short: "跳过 hashcat 的稳定性与兼容性警告。",
    detail: "可能得到错误结果、崩溃或不稳定内核。只用于确认警告可以接受的诊断场景。"
  }
};

export function guidanceFor(key: string): Guidance {
  return guidance[key] ?? {
    short: "该参数控制当前任务的 hashcat 行为。",
    detail: "完整定义与版本差异请参考 hashcat 帮助和官方文档。"
  };
}
