export type StringMap<T> = { [address: string]: T };

export type ClipboardSettings = {
    tag: string,
    copySlot: number,
    pasteSlot: number,
};