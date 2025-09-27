import React from 'react';
import Head from 'next/head';
import ContractChecker from '@/components/ContractChecker';
import Layout from '@/components/Layout';

export default function ContractTestPage() {
    return (
        <>
            <Head>
                <title>WorldDAO • Contract Checker</title>
                <meta name="description" content="Check WorldDAO contract deployments" />
            </Head>
            <Layout>
                <div style={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                    padding: '20px'
                }}>
                    <ContractChecker />
                </div>
            </Layout>
        </>
    );
}