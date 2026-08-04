import { Switch } from "@/components/ui";

const SwitchThumbSizes = () => {
  return (
    <div className="flex flex-wrap gap-5">
      <Switch
        defaultChecked
        label="Default"
        style={{ "--thumb-border": "6px" } as React.CSSProperties}
      />
      <Switch
        defaultChecked
        label="Default"
        style={{ "--thumb-border": "5px" } as React.CSSProperties}
      />
      <Switch
        defaultChecked
        label="Default"
        style={{ "--thumb-border": "4px" } as React.CSSProperties}
      />
      <Switch
        defaultChecked
        label="Default"
        style={{ "--thumb-border": "3px" } as React.CSSProperties}
      />
      <Switch defaultChecked label="Default" />
    </div>
  );
};

export { SwitchThumbSizes };
