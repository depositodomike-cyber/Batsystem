import { type ComponentPropsItem } from "@/components/docs/demo/DemoLayout/ComponentProps";

export const componentProps: ComponentPropsItem[] = [
    {
        componentName: "Range",
        desc: "A customizable range slider component for selecting value.",
        props: [
            {
                name: "defaultValue",
                type: "number",
                default: "0",
                description: "The initial value of the range slider.",
            },           
            {
                name: "className",
                type: "string",
                description: "Additional CSS class names to apply to the input range element.",
            },
            {
                name: "color",
                type: "ColorType",
                default: "neutral",
                description: "Specifies the color theme for the range slider.",
            },
            {
                name: "thumbSize",
                type: "string",
                default: "1.125rem",
                description: "Defines the size of the slider's thumb",
            },
            {
                name: "trackSize",
                type: "string",
                default: "0.375rem",
                description: "Defines the size (thickness) of the slider's track.",
            },
            {
                name: "style",
                type: "React.CSSProperties",
                description: "Inline styles to apply to the root element.",
            },
        ],
    }
];
