enum Shape {
    Default,
    IconSquare,
}

enum Size {
    Default,
    Small,
    Large,
    XSmall = 3,
}

enum Variant {
    Primary,
    Secondary,
    Tertiary,
}

export const Options = { Shape, Size, Variant };

export type ButtonProps = JSX.IntrinsicElements['button'] & {
    shape?: Shape;
    size?: Size;
    variant?: Variant;
};
