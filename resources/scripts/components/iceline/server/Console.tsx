import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalOptions, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SearchBarAddon } from 'xterm-addon-search-bar';
import { WebLinksAddon } from 'xterm-addon-web-links';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ServerContext } from '@/state/server';
import styled from 'styled-components/macro';
import { usePermissions } from '@/plugins/usePermissions';
import tw, { theme as th } from 'twin.macro';
import useEventListener from '@/plugins/useEventListener';
import { debounce } from 'debounce';
import { usePersistedState } from '@/plugins/usePersistedState';
import FiveMLicenseKeyModal from '@/components/iceline/FiveMLicenseKeyModal';
import 'xterm/css/xterm.css';

const theme = {
    background: th`colors.black`.toString(),
    cursor: 'transparent',
    black: th`colors.black`.toString(),
    red: '#E54B4B',
    green: '#9ECE58',
    yellow: '#FAED70',
    blue: '#396FE2',
    magenta: '#BB80B3',
    cyan: '#2DDAFD',
    white: '#d0d0d0',
    brightBlack: 'rgba(255, 255, 255, 0.2)',
    brightRed: '#FF5370',
    brightGreen: '#C3E88D',
    brightYellow: '#FFCB6B',
    brightBlue: '#82AAFF',
    brightMagenta: '#C792EA',
    brightCyan: '#89DDFF',
    brightWhite: '#ffffff',
    selection: '#FAF089',
};

const terminalProps: ITerminalOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    fontSize: 12,
    fontFamily: th('fontFamily.mono'),
    rows: 30,
    theme: theme,
};

const TerminalDiv = styled.div`
    &::-webkit-scrollbar {
        width: 8px;
    }

    &::-webkit-scrollbar-thumb {
        ${tw`bg-neutral-900`};
    }
`;

const CommandInput = styled.input`
    ${tw`text-sm transition-colors duration-150 px-2 bg-transparent border-0 border-b-2 border-transparent text-neutral-100 p-2 pl-0 w-full focus:ring-0`}
    &:focus {
        ${tw`border-cyan-700`};
    }
`;

export default () => {
    const TERMINAL_PRELUDE = '\u001b[1m\u001b[33mcontainer@iceline~ \u001b[0m';
    const ref = useRef<HTMLDivElement>(null);
    const terminal = useMemo(() => new Terminal({ ...terminalProps }), []);
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const searchBar = new SearchBarAddon({ searchAddon });
    const webLinksAddon = new WebLinksAddon();
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const [canSendCommands] = usePermissions(['control.console']);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const [history, setHistory] = usePersistedState<string[]>(`${serverId}:command_history`, []);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const [showFiveMLicenseKeyModal, setShowFiveMLicenseKeyModal] = useState(false);

    const handleConsoleOutput = (line: string, prelude = false) => {
        if (line.includes('Could not authenticate server license key')) {
            setShowFiveMLicenseKeyModal(true);
        }

        terminal.writeln((prelude ? TERMINAL_PRELUDE : '') + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');
    };

    const handleTransferStatus = (status: string) => {
        switch (status) {
            // Sent by either the source or target node if a failure occurs.
            case 'failure':
                terminal.writeln(TERMINAL_PRELUDE + 'Transfer has failed.\u001b[0m');
                return;

            // Sent by the source node whenever the server was archived successfully.
            case 'archive':
                terminal.writeln(TERMINAL_PRELUDE + 'Server has been archived successfully, attempting connection to target node..\u001b[0m');
        }
    };

    const handleDaemonErrorOutput = (line: string) => terminal.writeln(TERMINAL_PRELUDE + '\u001b[1m\u001b[41m' + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');

    const handlePowerChangeEvent = (state: string) => terminal.writeln(TERMINAL_PRELUDE + 'Server marked as ' + state + '...\u001b[0m');

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            const newIndex = Math.min(historyIndex + 1, history!.length - 1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';

            // By default up arrow will also bring the cursor to the start of the line,
            // so we'll preventDefault to keep it at the end.
            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            const newIndex = Math.max(historyIndex - 1, -1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';
        }

        const command = e.currentTarget.value;
        if (e.key === 'Enter' && command.length > 0) {
            setHistory((prevHistory) => [command, ...prevHistory!].slice(0, 32));
            setHistoryIndex(-1);

            instance && instance.send('send command', command);
            e.currentTarget.value = '';
        }
    };

    useEffect(() => {
        if (connected && ref.current && !terminal.element) {
            terminal.open(ref.current);
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(searchAddon);
            terminal.loadAddon(searchBar);
            terminal.loadAddon(webLinksAddon);
            fitAddon.fit();

            // Add support for capturing keys
            terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
                // Ctrl + C (Copy)
                if (e.ctrlKey && e.key === 'c') {
                    document.execCommand('copy');
                    return false;
                }

                // Ctrl + F (Find)
                if (e.ctrlKey && e.key === 'f') {
                    searchBar.show();
                    return false;
                }

                // Escape
                if (e.key === 'Escape') {
                    searchBar.hidden();
                }

                return true;
            });
        }
    }, [terminal, connected]);

    const fit = debounce(() => {
        fitAddon.fit();
    }, 100);

    useEventListener('resize', () => fit());

    useEffect(() => {
        if (connected && instance) {
            // Do not clear the console if the server is being transferred.
            if (!isTransferring) {
                terminal.clear();
            }

            instance.addListener('status', handlePowerChangeEvent);
            instance.addListener('console output', handleConsoleOutput);
            instance.addListener('install output', handleConsoleOutput);
            instance.addListener('transfer logs', handleConsoleOutput);
            instance.addListener('transfer status', handleTransferStatus);
            instance.addListener('daemon message', (line) => handleConsoleOutput(line, true));
            instance.addListener('daemon error', handleDaemonErrorOutput);
            instance.send('send logs');
        }

        return () => {
            instance &&
                instance
                    .removeListener('status', handlePowerChangeEvent)
                    .removeListener('console output', handleConsoleOutput)
                    .removeListener('install output', handleConsoleOutput)
                    .removeListener('transfer logs', handleConsoleOutput)
                    .removeListener('transfer status', handleTransferStatus)
                    .removeListener('daemon message', (line) => handleConsoleOutput(line, true))
                    .removeListener('daemon error', handleDaemonErrorOutput);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, instance]);

    return (
        <>
            <FiveMLicenseKeyModal visible={showFiveMLicenseKeyModal} onDismissed={() => setShowFiveMLicenseKeyModal(false)} />
            <div css={tw`text-xs font-mono relative`}>
                <SpinnerOverlay visible={!connected} size={'large'} />
                <div
                    css={[tw`rounded-t bg-icelinebox-700 w-full p-4`, !canSendCommands && tw`rounded-b`]}
                    style={{
                        minHeight: '16rem',
                        maxHeight: '32rem',
                    }}
                >
                    <TerminalDiv id={'terminal'} ref={ref} />
                </div>
                {canSendCommands && (
                    <div css={tw`rounded-b bg-icelinebox-700 text-neutral-100 flex`}>
                        <div css={tw`flex-shrink-0 p-2 font-bold`}>$</div>
                        <div css={tw`w-full`}>
                            <CommandInput
                                type={'text'}
                                placeholder={'Type a command...'}
                                aria-label={'Console command input.'}
                                disabled={!instance || !connected}
                                onKeyDown={handleCommandKeyDown}
                            />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
