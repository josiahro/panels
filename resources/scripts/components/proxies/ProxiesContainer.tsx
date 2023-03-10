import React, { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getProxies from '@/api/getProxies';
import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';

import ServerBox from '@/components/iceline/dashboard/ServerBox';
import SearchModal from '@/components/dashboard/search/SearchModal';

export default () => {
    const [searchVisible, setSearchVisible] = useState(false);

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [page, setPage] = useState(1);
    const { rootAdmin } = useStoreState((state) => state.user.data!);
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState('show_all_proxies', false);

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(['/api/client/proxies', showOnlyAdmin, page], () =>
        getProxies({ page, type: showOnlyAdmin ? 'admin' : undefined, include: 'egg' })
    );

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'proxy-dashboard', error });
        if (!error) clearFlashes('proxy-dashboard');
    }, [error]);

    return (
        <PageContentBlock title={'Proxy Dashboard'} showFlashKey={'proxy-dashboard'}>
            {searchVisible && <SearchModal appear visible={searchVisible} onDismissed={() => setSearchVisible(false)} />}
            <div css={tw`flex flex-row items-center justify-between mb-6`}>
                <a css={tw`flex flex-row items-center text-sm cursor-pointer`} style={{ color: '#9092a7' }} onClick={() => setSearchVisible(true)}>
                    <img css={tw`mr-2`} src={'/assets/iceline/servers/search.svg'} alt={'search'} />
                    <span>Search</span>
                </a>
                {rootAdmin && (
                    <div css={tw`flex justify-end items-center`}>
                        <p css={tw`uppercase text-xs text-neutral-400 mr-2`}>{showOnlyAdmin ? "Showing other's proxies" : 'Showing your proxies'}</p>
                        <Switch name={'show_all_proxies'} defaultChecked={showOnlyAdmin} onChange={() => setShowOnlyAdmin((s) => !s)} />
                    </div>
                )}
            </div>
            {!servers ? (
                <Spinner centered size={'large'} />
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) =>
                        items.length > 0 ? (
                            <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-4`}>
                                {items.map((server, index) => (
                                    <ServerBox key={server.uuid} server={server} css={index > 0 ? tw`mt-2` : undefined} />
                                ))}
                            </div>
                        ) : (
                            <p css={tw`text-center text-sm text-neutral-400`}>
                                {showOnlyAdmin ? 'There are no other proxies to display.' : 'There are no proxies associated with your account.'}
                            </p>
                        )
                    }
                </Pagination>
            )}
        </PageContentBlock>
    );
};
