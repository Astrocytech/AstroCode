import { TextAttributes, Box, Text } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog, type DialogContext } from "./dialog"
import { createStore } from "solid-js/store"
import { useKeyboard } from "@opentui/solid"
import { Locale } from "@/util/locale"

export type DialogSelfHealProps = {
  error: string
  onFix: () => void
  onSkip: () => void
}

export function DialogSelfHeal(props: DialogSelfHealProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const [store, setStore] = createStore({
    active: "fix" as "fix" | "skip",
  })

  useKeyboard((evt) => {
    if (evt.name === "return") {
      if (store.active === "fix") props.onFix()
      if (store.active === "skip") props.onSkip()
      dialog.clear()
    }
    if (evt.name === "left" || evt.name === "right") {
      setStore("active", store.active === "fix" ? "skip" : "fix")
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.error}>
          Error Occurred
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          ✕
        </text>
      </box>
      <text fg={theme.text} width={60}>
        {props.error.slice(0, 200)}
      </text>
      <text fg={theme.warning}>Would you like to fix this bug?</text>
      <box flexDirection="row" gap={2}>
        {["fix", "skip"].map((key) => (
          <box
            flexDirection="row"
            gap={1}
            onMouseUp={() => (key === "fix" ? props.onFix() : props.onSkip())}
          >
            <text fg={key === store.active ? theme.selectedListItemText : theme.textMuted}>
              {key === "fix" ? "✓ Fix" : "✗ Skip"}
            </text>
          </box>
        ))}
      </box>
    </box>
  )
}

DialogSelfHeal.show = (dialog: DialogContext, error: string) => {
  return new Promise<"fix" | "skip">((resolve) => {
    dialog.replace(
      () => (
        <DialogSelfHeal
          error={error}
          onFix={() => resolve("fix")}
          onSkip={() => resolve("skip")}
        />
      ),
      () => resolve("skip"),
    )
  })
}