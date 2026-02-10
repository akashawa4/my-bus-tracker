export const Footer: React.FC = () => {
    return (
        <footer className="flex-shrink-0 bg-card border-t border-border py-3 px-4">
            <div className="text-center">
                <p className="text-xs text-muted-foreground">
                    Designed and Developed by{' '}
                    <a
                        href="https://akash.solutions"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                        Akash.Solutions
                    </a>
                </p>
            </div>
        </footer>
    );
};
